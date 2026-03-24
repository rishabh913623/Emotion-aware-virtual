"""Authentication routes for students and instructors."""
import os
from datetime import datetime, timedelta, timezone
import jwt
from flask import Blueprint, request, jsonify

auth_bp = Blueprint("auth", __name__)

USERS = {
    "student": {"password": "student123", "role": "student", "student_id": 1},
    "instructor": {"password": "instructor123", "role": "instructor", "student_id": None},
}


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


@auth_bp.route("/login", methods=["POST"])
def login():
    """Authenticate user and return token."""
    data = request.get_json() or {}
    username = data.get("username", "")
    password = data.get("password", "")

    user = USERS.get(username)
    if not user or user["password"] != password:
        return jsonify({"error": "Invalid credentials"}), 401

    token = create_token({
        "username": username,
        "role": user["role"],
        "student_id": user["student_id"],
    })

    return jsonify({
        "token": token,
        "role": user["role"],
        "student_id": user["student_id"],
    })


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
