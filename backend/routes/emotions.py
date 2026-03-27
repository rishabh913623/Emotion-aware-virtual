"""Dashboard endpoints for emotion analytics."""
from flask import Blueprint, request, jsonify

from utils.db import fetch_emotions, fetch_emotion_counts, fetch_student_wise_emotions, fetch_emotions_by_room

emotions_bp = Blueprint("emotions", __name__)


@emotions_bp.route("/emotions", methods=["GET"])
def get_emotions():
    """Return recent emotion entries and counts."""
    try:
        limit = int(request.args.get("limit", 200))
        history = fetch_emotions(limit)
        counts = fetch_emotion_counts(limit)
        student_wise = fetch_student_wise_emotions(limit * 2)
        return jsonify({
            "history": history,
            "counts": {row["emotion"]: row["count"] for row in counts},
            "student_wise": student_wise,
        })
    except Exception as exc:  # pragma: no cover - defensive error handling
        return jsonify({"error": "Failed to fetch emotions", "details": str(exc)}), 500


@emotions_bp.route("/emotions/<room_id>", methods=["GET"])
def get_room_emotions(room_id):
    """Return room-scoped emotion timeline for instructor visualization."""
    try:
        limit = int(request.args.get("limit", 500))
        rows = fetch_emotions_by_room(room_id, limit)
        normalized_rows = [
            {
                **row,
                "time": str(row.get("timestamp")),
            }
            for row in rows
        ]
        return jsonify(normalized_rows)
    except Exception as exc:  # pragma: no cover - defensive error handling
        return jsonify({"error": "Failed to fetch room emotions", "details": str(exc)}), 500
