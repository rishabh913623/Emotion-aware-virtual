"""Dashboard endpoints for emotion analytics."""
from flask import Blueprint, request, jsonify

from utils.db import fetch_emotions, fetch_emotion_counts, fetch_student_wise_emotions

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
