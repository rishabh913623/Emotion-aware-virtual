"""Database helpers for emotion storage and retrieval."""
import os
from typing import List, Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor


def get_db_connection():
    """Create a new database connection."""
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return psycopg2.connect(database_url, cursor_factory=RealDictCursor)

    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME", "emotion_db"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        cursor_factory=RealDictCursor,
    )


def insert_emotion(student_id: int, emotion: str, confidence: float) -> None:
    """Insert a new emotion record."""
    query = """
        INSERT INTO emotions (student_id, emotion, confidence)
        VALUES (%s, %s, %s)
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (student_id, emotion, confidence))


def fetch_emotions(limit: int = 200) -> List[Dict[str, Any]]:
    """Fetch recent emotions for dashboard."""
    query = """
        SELECT id, student_id, emotion, confidence, timestamp
        FROM emotions
        ORDER BY timestamp DESC
        LIMIT %s
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (limit,))
            return cursor.fetchall()


def fetch_emotion_counts(limit: int = 200) -> List[Dict[str, Any]]:
    """Fetch counts for each emotion in recent window."""
    query = """
        SELECT emotion, COUNT(*) as count
        FROM (
            SELECT emotion
            FROM emotions
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
    query = """
        SELECT id, student_id, emotion, confidence, timestamp
        FROM emotions
        WHERE student_id = %s
        ORDER BY timestamp DESC
        LIMIT %s
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (student_id, limit))
            return cursor.fetchall()


def fetch_student_wise_emotions(limit: int = 500) -> List[Dict[str, Any]]:
    """Fetch student-wise emotion counts for instructor dashboard."""
    query = """
        SELECT student_id, emotion, COUNT(*) AS count
        FROM (
            SELECT student_id, emotion
            FROM emotions
            ORDER BY timestamp DESC
            LIMIT %s
        ) AS recent
        GROUP BY student_id, emotion
        ORDER BY student_id ASC
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (limit,))
            return cursor.fetchall()
