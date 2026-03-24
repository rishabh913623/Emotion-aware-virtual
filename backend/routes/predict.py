"""Prediction endpoint for emotion detection."""
from datetime import datetime, timezone
from collections import Counter, defaultdict, deque
from flask import Blueprint, request, jsonify
import numpy as np

from utils.model import get_emotion_model
from utils.preprocess import decode_image_bytes, decode_base64_image, preprocess_for_model
from utils.db import insert_emotion
from socketio_instance import socketio

predict_bp = Blueprint("predict", __name__)

EMOTION_CLASSES = ["Engaged", "Confused", "Bored", "Distracted", "Neutral"]
CONFIDENCE_THRESHOLD = 0.6
MAJORITY_WINDOW = 3
prediction_windows: dict[int, deque[str]] = defaultdict(lambda: deque(maxlen=MAJORITY_WINDOW))


def majority_vote(student_id: int, emotion: str) -> str:
    """Apply rolling majority vote over last three predictions."""
    prediction_windows[student_id].append(emotion)
    counted = Counter(prediction_windows[student_id])
    return counted.most_common(1)[0][0]


@predict_bp.route("/predict", methods=["POST"])
def predict_emotion():
    """Predict emotion from an uploaded image."""
    try:
        student_id_raw = request.form.get("student_id") or (request.json or {}).get("student_id") or "1"
        try:
            student_id = int(student_id_raw)
        except (TypeError, ValueError):
            return jsonify({"error": "student_id must be an integer"}), 400

        image = None
        if "image" in request.files:
            image_bytes = request.files["image"].read()
            image = decode_image_bytes(image_bytes)
        elif request.json and "image_base64" in request.json:
            image = decode_base64_image(request.json["image_base64"])
        else:
            return jsonify({"error": "No image provided."}), 400

        tensor, face_detected = preprocess_for_model(image)
        if not face_detected or tensor is None:
            return jsonify({
                "student_id": student_id,
                "emotion": "No Face",
                "confidence": 0.0,
                "message": "No face detected. Prediction skipped.",
            })

        model = get_emotion_model()
        predictions = model.predict(tensor, verbose=0)
        predicted_index = int(np.argmax(predictions[0]))
        confidence = float(predictions[0][predicted_index])

        if confidence < CONFIDENCE_THRESHOLD:
            return jsonify({
                "student_id": student_id,
                "emotion": "Uncertain",
                "confidence": confidence,
                "message": "Low confidence prediction ignored.",
            })

        raw_emotion = EMOTION_CLASSES[predicted_index]
        emotion = majority_vote(student_id, raw_emotion)

        insert_emotion(student_id, emotion, confidence)
        socketio.emit(
            "emotion_update",
            {
                "student_id": student_id,
                "emotion": emotion,
                "confidence": confidence,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        return jsonify({
            "student_id": student_id,
            "emotion": emotion,
            "raw_emotion": raw_emotion,
            "confidence": confidence,
            "probabilities": {cls: float(prob) for cls, prob in zip(EMOTION_CLASSES, predictions[0])},
        })
    except FileNotFoundError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception as exc:  # pragma: no cover - defensive error handling
        return jsonify({"error": "Prediction failed", "details": str(exc)}), 500
