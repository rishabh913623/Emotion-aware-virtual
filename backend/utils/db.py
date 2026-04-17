"""Database helpers for emotion storage and retrieval."""
import os
from collections import defaultdict
from datetime import datetime, timezone
from typing import List, Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor


def ensure_emotion_logs_table() -> None:
    """Ensure emotion logs table exists for room-scoped emotion tracking."""
    query = """
        CREATE TABLE IF NOT EXISTS emotion_logs (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            room_id VARCHAR(128) NOT NULL,
            emotion VARCHAR(32) NOT NULL,
            confidence NUMERIC(5, 4) NOT NULL DEFAULT 0,
            timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_emotion_logs_room_time ON emotion_logs (room_id, timestamp ASC);
        CREATE INDEX IF NOT EXISTS idx_emotion_logs_user_time ON emotion_logs (user_id, timestamp DESC);
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query)


def get_db_connection():
    """Create a new database connection."""
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return psycopg2.connect(database_url, cursor_factory=RealDictCursor, connect_timeout=5)

    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME", "emotion_db"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        cursor_factory=RealDictCursor,
        connect_timeout=5,
    )


def insert_emotion(user_id: int | str, room_id: str, emotion: str, confidence: float) -> None:
    """Insert a new room-scoped emotion record."""
    ensure_emotion_logs_table()
    query = """
        INSERT INTO emotion_logs (user_id, room_id, emotion, confidence)
        VALUES (%s, %s, %s, %s)
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (str(user_id), room_id, emotion, confidence))


def insert_emotion_metadata(student_id: int | str, emotion: str, confidence: float, timestamp: str | None = None, room_id: str | None = None) -> None:
    """Insert metadata-only emotion record from frontend detection."""
    ensure_emotion_logs_table()

    normalized_room = room_id or "default-room"
    normalized_timestamp = datetime.now(timezone.utc)
    if timestamp:
        try:
            normalized_timestamp = datetime.fromisoformat(str(timestamp).replace("Z", "+00:00"))
        except ValueError:
            normalized_timestamp = datetime.now(timezone.utc)

    query = """
        INSERT INTO emotion_logs (user_id, room_id, emotion, confidence, timestamp)
        VALUES (%s, %s, %s, %s, %s)
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (str(student_id), normalized_room, emotion, float(confidence), normalized_timestamp))


def student_exists(student_id: int) -> bool:
    """Return whether a user row exists for the given student id."""
    query = "SELECT 1 FROM users WHERE id = %s LIMIT 1"
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (student_id,))
            return cursor.fetchone() is not None


def fetch_emotions(limit: int = 200) -> List[Dict[str, Any]]:
    """Fetch recent emotions for dashboard."""
    ensure_emotion_logs_table()
    query = """
        SELECT id, user_id AS student_id, room_id, emotion, confidence, timestamp
        FROM emotion_logs
        ORDER BY timestamp DESC
        LIMIT %s
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (limit,))
            return cursor.fetchall()


def fetch_emotion_counts(limit: int = 200) -> List[Dict[str, Any]]:
    """Fetch counts for each emotion in recent window."""
    ensure_emotion_logs_table()
    query = """
        SELECT emotion, COUNT(*) as count
        FROM (
            SELECT emotion
            FROM emotion_logs
            ORDER BY timestamp DESC
            LIMIT %s
        ) AS recent
        GROUP BY emotion
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (limit,))
            return cursor.fetchall()


def fetch_emotions_for_student(student_id: int, limit: int = 50) -> List[Dict[str, Any]]:
    """Fetch recent emotions for a specific student."""
    ensure_emotion_logs_table()
    query = """
        SELECT id, user_id AS student_id, room_id, emotion, confidence, timestamp
        FROM emotion_logs
        WHERE user_id = %s
        ORDER BY timestamp DESC
        LIMIT %s
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (student_id, limit))
            return cursor.fetchall()


def fetch_student_wise_emotions(limit: int = 500) -> List[Dict[str, Any]]:
    """Fetch student-wise emotion counts for instructor dashboard."""
    ensure_emotion_logs_table()
    query = """
        SELECT user_id AS student_id, emotion, COUNT(*) AS count
        FROM (
            SELECT user_id, emotion
            FROM emotion_logs
            ORDER BY timestamp DESC
            LIMIT %s
        ) AS recent
        GROUP BY user_id, emotion
        ORDER BY user_id ASC
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (limit,))
            return cursor.fetchall()


def fetch_emotions_by_room(room_id: str, limit: int = 500) -> List[Dict[str, Any]]:
    """Fetch room-scoped emotion timeline sorted oldest to newest."""
    ensure_emotion_logs_table()
    query = """
        SELECT user_id, room_id, emotion, confidence, timestamp
        FROM emotion_logs
        WHERE room_id = %s
        ORDER BY timestamp ASC
        LIMIT %s
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (room_id, limit))
            return cursor.fetchall()


def fetch_class_emotion_distribution(room_id: str | None = None, limit: int = 500) -> Dict[str, int]:
    """Return class-wide emotion distribution from latest entries."""
    ensure_emotion_logs_table()

    where_clause = "WHERE room_id = %s" if room_id else ""
    query = f"""
        SELECT emotion, COUNT(*) AS count
        FROM (
            SELECT emotion
            FROM emotion_logs
            {where_clause}
            ORDER BY timestamp DESC
            LIMIT %s
        ) AS recent
        GROUP BY emotion
    """

    params: tuple[Any, ...] = (room_id, limit) if room_id else (limit,)
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, params)
            rows = cursor.fetchall()

    return {row["emotion"]: int(row["count"]) for row in rows}


def fetch_student_rolling_averages(room_id: str | None = None, window_size: int = 10) -> List[Dict[str, Any]]:
    """Return rolling average emotion score per student from recent N entries."""
    ensure_emotion_logs_table()

    where_clause = "WHERE room_id = %s" if room_id else ""
    query = f"""
        SELECT user_id AS student_id, room_id, emotion, confidence, timestamp
        FROM emotion_logs
        {where_clause}
        ORDER BY timestamp DESC
        LIMIT %s
    """

    sample_limit = max(window_size * 200, 200)
    params: tuple[Any, ...] = (room_id, sample_limit) if room_id else (sample_limit,)
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, params)
            rows = cursor.fetchall()

    emotion_score_map = {
        "engaged": 5,
        "happy": 5,
        "neutral": 3,
        "confused": 2,
        "distracted": 2,
        "bored": 1,
        "sad": 1,
    }

    grouped: dict[str, list[Dict[str, Any]]] = defaultdict(list)
    for row in rows:
        student_id = str(row.get("student_id") or "")
        if not student_id:
            continue
        if len(grouped[student_id]) < window_size:
            grouped[student_id].append(row)

    response: list[Dict[str, Any]] = []
    for student_id, entries in grouped.items():
        if not entries:
            continue

        score_sum = 0.0
        confidence_sum = 0.0
        dominant_counter: dict[str, int] = defaultdict(int)
        latest_timestamp = entries[0].get("timestamp")

        for entry in entries:
            emotion = str(entry.get("emotion") or "Unknown")
            score_sum += emotion_score_map.get(emotion.lower(), 2)
            confidence_sum += float(entry.get("confidence") or 0)
            dominant_counter[emotion] += 1

        dominant_emotion = max(dominant_counter.items(), key=lambda pair: pair[1])[0]
        response.append(
            {
                "student_id": student_id,
                "samples": len(entries),
                "rolling_average_score": round(score_sum / len(entries), 3),
                "average_confidence": round(confidence_sum / len(entries), 4),
                "dominant_emotion": dominant_emotion,
                "last_updated": latest_timestamp,
            }
        )

    response.sort(key=lambda item: item["student_id"])
    return response
