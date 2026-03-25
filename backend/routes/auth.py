"""Authentication routes for students and instructors."""
import os
from datetime import datetime, timedelta, timezone

import jwt
import psycopg2
from flask import Blueprint, jsonify, request

from utils.db import get_db_connection

auth_bp = Blueprint("auth", __name__)


def ensure_users_table() -> None:
    """Ensure baseline users table exists for authentication."""
    query = """
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE,
            password TEXT
        );
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query)


def create_token(payload: dict) -> str:
    """Create a signed JWT token."""
    secret = os.getenv("JWT_SECRET", "dev_secret")
    exp = datetime.now(timezone.utc) + timedelta(hours=8)
    payload = {**payload, "exp": exp}
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_token(token: str) -> dict:
    """Decode JWT token and return payload."""
    secret = os.getenv("JWT_SECRET", "dev_secret")
    return jwt.decode(token, secret, algorithms=["HS256"])


@auth_bp.route("/auth/login", methods=["POST", "OPTIONS"])
@auth_bp.route("/login", methods=["POST", "OPTIONS"])
def login():
    """Authenticate user and return token."""
    if request.method == "OPTIONS":
        return jsonify({"ok": True}), 200

    print("LOGIN REQUEST:", request.json)

    data = request.get_json() or {}
    email = (data.get("email") or data.get("username") or "").strip()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "email/username and password are required"}), 400

    try:
        ensure_users_table()
        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT id, email, password FROM users WHERE email=%s",
                    (email,)
                )
                user = cursor.fetchone()
    except psycopg2.Error as exc:
        return jsonify({"error": f"Database unavailable: {str(exc).strip()}"}), 503

    if not user:
        return jsonify({"error": "User not found"}), 401

    stored_password = user["password"] if isinstance(user, dict) else user[2]
    if password != stored_password:
        return jsonify({"error": "Invalid credentials"}), 401

    user_id = user["id"] if isinstance(user, dict) else user[0]
    user_email = user["email"] if isinstance(user, dict) else user[1]
    role = data.get("role") or "student"

    token = create_token({
        "username": user_email.split("@")[0] if "@" in user_email else user_email,
        "email": user_email,
        "role": role,
        "student_id": user_id,
    })

    return jsonify({
        "message": "Login successful",
        "user_id": user_id,
        "email": user_email,
        "token": token,
        "role": role,
        "student_id": user_id,
    })


@auth_bp.route("/auth/register", methods=["POST", "OPTIONS"])
@auth_bp.route("/register", methods=["POST", "OPTIONS"])
def register():
    """Register user with safe duplicate checks."""
    if request.method == "OPTIONS":
        return jsonify({"ok": True}), 200

    data = request.get_json() or {}
    email = (data.get("email") or "").strip()
    password = data.get("password", "")
    role = (data.get("role") or "student").strip() or "student"
    name = (data.get("name") or (email.split("@")[0] if "@" in email else "User")).strip() or "User"

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    try:
        ensure_users_table()
        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT id FROM users WHERE email=%s", (email,))
                existing_user = cursor.fetchone()
                if existing_user:
                    return jsonify({"error": "User already exists"}), 400

                try:
                    cursor.execute(
                        "INSERT INTO users (email, password) VALUES (%s, %s) RETURNING id, email",
                        (email, password)
                    )
                except Exception:
                    connection.rollback()
                    cursor.execute(
                        "INSERT INTO users (name, role, email, password) VALUES (%s, %s, %s, %s) RETURNING id, email",
                        (name, role, email, password)
                    )

                created_user = cursor.fetchone()
    except psycopg2.Error as exc:
        return jsonify({"error": f"Database unavailable: {str(exc).strip()}"}), 503

    created_user_id = created_user["id"] if isinstance(created_user, dict) else created_user[0]
    created_user_email = created_user["email"] if isinstance(created_user, dict) else created_user[1]

    token = create_token({
        "username": created_user_email.split("@")[0] if "@" in created_user_email else created_user_email,
        "email": created_user_email,
        "role": role,
        "student_id": created_user_id,
    })

    return jsonify({
        "message": "Registration successful",
        "user_id": created_user_id,
        "email": created_user_email,
        "token": token,
        "role": role,
        "student_id": created_user_id,
    }), 201


@auth_bp.route("/auth/me", methods=["GET"])
@auth_bp.route("/me", methods=["GET"])
def me():
    """Return current user from Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return jsonify({"error": "Missing token"}), 401

    token = auth_header.replace("Bearer ", "", 1)
    try:
        payload = decode_token(token)
        return jsonify({
            "username": payload.get("username"),
            "role": payload.get("role"),
            "student_id": payload.get("student_id"),
        })
    except jwt.PyJWTError:
        return jsonify({"error": "Invalid token"}), 401


@auth_bp.route("/auth/health", methods=["GET"])
def auth_health():
    """Return database connectivity status for authentication subsystem."""
    try:
        ensure_users_table()
        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1 AS ok;")
                result = cursor.fetchone()

                cursor.execute("SELECT COUNT(*) AS users_count FROM users;")
                count_row = cursor.fetchone()

        probe_result = result["ok"] if isinstance(result, dict) else result[0]
        users_count = count_row["users_count"] if isinstance(count_row, dict) else count_row[0]

        return jsonify({
            "status": "ok",
            "db": "connected",
            "result": probe_result,
            "users_count": users_count,
        })
    except Exception as e:
        import traceback

        traceback.print_exc()
        return jsonify({
            "status": "error",
            "db": "failed",
            "message": str(e),
        }), 500
