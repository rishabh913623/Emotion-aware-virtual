"""Dashboard endpoints for emotion analytics."""
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify

from utils.db import (
    fetch_emotions,
    fetch_emotion_counts,
    fetch_student_wise_emotions,
    fetch_emotions_by_room,
    insert_emotion_metadata,
    fetch_class_emotion_distribution,
    fetch_student_rolling_averages,
)
from socketio_instance import socketio

emotions_bp = Blueprint("emotions", __name__)


@emotions_bp.route("/emotion-data", methods=["POST"])
def ingest_emotion_data():
    """Store metadata-only emotion signal from frontend detectors."""
    payload = request.get_json(silent=True) or {}
    student_id = payload.get("student_id")
    emotion = str(payload.get("emotion") or "").strip()
    confidence = payload.get("confidence")
    timestamp = payload.get("timestamp")
    room_id = payload.get("room_id")

    if student_id is None:
        return jsonify({"error": "student_id is required"}), 400
    if not emotion:
        return jsonify({"error": "emotion is required"}), 400

    try:
        normalized_confidence = float(confidence if confidence is not None else 0)
    except (TypeError, ValueError):
        return jsonify({"error": "confidence must be numeric"}), 400

    try:
        insert_emotion_metadata(
            student_id=student_id,
            emotion=emotion,
            confidence=normalized_confidence,
            timestamp=timestamp,
            room_id=room_id,
        )
        socketio.emit(
            "emotion_update",
            {
                "student_id": student_id,
                "room_id": room_id,
                "emotion": emotion,
                "confidence": normalized_confidence,
                "timestamp": timestamp or datetime.now(timezone.utc).isoformat(),
            },
        )
        return jsonify({"status": "ok"}), 201
    except Exception as exc:  # pragma: no cover - defensive error handling
        return jsonify({"error": "Failed to store emotion data", "details": str(exc)}), 500


@emotions_bp.route("/emotion-data/summary", methods=["GET"])
def get_emotion_data_summary():
    """Return rolling student emotion metrics and class distribution."""
    try:
        room_id = request.args.get("room_id")
        window_size = int(request.args.get("window_size", 10))
        distribution_limit = int(request.args.get("distribution_limit", 500))

        student_rolling = fetch_student_rolling_averages(room_id=room_id, window_size=max(1, window_size))
        class_distribution = fetch_class_emotion_distribution(room_id=room_id, limit=max(1, distribution_limit))

        return jsonify(
            {
                "room_id": room_id,
                "student_rolling": student_rolling,
                "class_distribution": class_distribution,
            }
        )
    except Exception as exc:  # pragma: no cover - defensive error handling
        return jsonify({"error": "Failed to fetch emotion summary", "details": str(exc)}), 500


@emotions_bp.route("/emotion-data/student/<student_id>", methods=["GET"])
def get_student_emotion_timeline(student_id):
    """Return recent emotion samples for one student."""
    try:
        limit = int(request.args.get("limit", 30))
        room_id = request.args.get("room_id")
        rows = fetch_emotions_by_room(room_id, max(limit * 4, limit)) if room_id else fetch_emotions(max(limit * 20, limit))

        filtered = [
            row
            for row in rows
            if str(row.get("student_id") or row.get("user_id")) == str(student_id)
        ][:limit]

        return jsonify(filtered)
    except Exception as exc:  # pragma: no cover - defensive error handling
        return jsonify({"error": "Failed to fetch student timeline", "details": str(exc)}), 500


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
