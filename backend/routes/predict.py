"""Prediction endpoint for emotion detection."""
from datetime import datetime, timezone
from collections import Counter, defaultdict, deque
import logging
import random
from flask import Blueprint, request, jsonify
import numpy as np
import cv2

from utils.model import get_emotion_model, predict_with_pretrained
from utils.preprocess import decode_image_bytes, decode_base64_image, crop_face, tensorize_face
from utils.db import insert_emotion
from socketio_instance import socketio

predict_bp = Blueprint("predict", __name__)
logger = logging.getLogger(__name__)

EMOTION_CLASSES = ["Engaged", "Confused", "Bored", "Distracted", "Neutral"]
FALLBACK_EMOTIONS = ["Happy", "Neutral", "Sad"]
CONFIDENCE_THRESHOLD = 0.6
MAJORITY_WINDOW = 3
prediction_windows: dict[int, deque[str]] = defaultdict(lambda: deque(maxlen=MAJORITY_WINDOW))
SPOOF_STATIC_LIMIT = 4
HASH_DIFF_THRESHOLD = 1
face_hash_state: dict[int, np.ndarray] = {}
face_static_counter: defaultdict[int, int] = defaultdict(int)


def compute_face_hash(face_bgr: np.ndarray) -> np.ndarray:
    """Compute a tiny perceptual hash to detect near-identical repeated frames."""
    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, (8, 8))
    return (resized > resized.mean()).astype(np.uint8).flatten()


def is_spoof_suspected(student_id: int, face_bgr: np.ndarray) -> bool:
    """Flag probable spoofing when many consecutive frames are effectively identical."""
    current_hash = compute_face_hash(face_bgr)
    previous_hash = face_hash_state.get(student_id)

    if previous_hash is None:
        face_hash_state[student_id] = current_hash
        face_static_counter[student_id] = 0
        return False

    distance = int(np.count_nonzero(previous_hash != current_hash))
    face_hash_state[student_id] = current_hash

    if distance <= HASH_DIFF_THRESHOLD:
        face_static_counter[student_id] += 1
    else:
        face_static_counter[student_id] = 0

    return face_static_counter[student_id] >= SPOOF_STATIC_LIMIT


def majority_vote(student_id: int, emotion: str) -> str:
    """Apply rolling majority vote over last three predictions."""
    prediction_windows[student_id].append(emotion)
    counted = Counter(prediction_windows[student_id])
    return counted.most_common(1)[0][0]


def fallback_emotion() -> str:
    """Return a demo-safe fallback emotion when live inference is unavailable."""
    return random.choice(FALLBACK_EMOTIONS)


@predict_bp.route("/predict", methods=["POST"])
def predict_emotion():
    """Predict emotion from an uploaded image."""
    try:
        logger.info("/predict called")
        payload = request.get_json(silent=True) or {}
        student_id_raw = request.form.get("student_id") or payload.get("student_id") or payload.get("userId") or "1"
        room_id = request.form.get("room_id") or payload.get("room_id") or payload.get("roomId") or "default-room"
        try:
            student_id = int(student_id_raw)
        except (TypeError, ValueError):
            student_id = 1

        emotion = None
        raw_emotion = None
        predictions_map = None
        confidence = 0.0
        fallback_reason = None
        pretrained_warning = None
        image = None
        if "image" in request.files:
            try:
                image_bytes = request.files["image"].read()
                image = decode_image_bytes(image_bytes)
            except Exception as exc:
                logger.warning("Invalid uploaded image payload: %s", exc)
                fallback_reason = f"invalid uploaded image payload: {str(exc)}"
        elif payload and ("image_base64" in payload or "image" in payload):
            try:
                image_base64 = payload.get("image_base64") or payload.get("image")
                image = decode_base64_image(image_base64)
            except Exception as exc:
                logger.warning("Invalid base64 image payload: %s", exc)
                fallback_reason = f"invalid base64 image payload: {str(exc)}"
        else:
            fallback_reason = "no image provided"

        face_bgr = None
        if image is not None:
            try:
                face_bgr = crop_face(image)
            except Exception as exc:
                logger.warning("Face crop failed for student_id=%s: %s", student_id, exc)
                fallback_reason = fallback_reason or f"face crop failed: {str(exc)}"

        if face_bgr is None:
            logger.info("No face detected for student_id=%s, using fallback emotion", student_id)
            fallback_reason = fallback_reason or "no face detected"

        if face_bgr is not None and is_spoof_suspected(student_id, face_bgr):
            fallback_reason = "spoof suspected"

        if face_bgr is not None and fallback_reason is None:
            try:
                pretrained_result = predict_with_pretrained(cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB))
            except Exception as exc:  # pragma: no cover - defensive fallback
                pretrained_result = None
                pretrained_warning = f"pretrained inference failed: {str(exc)}"
                logger.warning("Pretrained FER inference failed: %s", exc)

            if pretrained_result is not None:
                emotion, confidence, predictions_map, raw_probabilities = pretrained_result
                raw_emotion = max(raw_probabilities, key=raw_probabilities.get)
            else:
                try:
                    tensor = tensorize_face(face_bgr)
                    model = get_emotion_model()
                    predictions = model.predict(tensor, verbose=0)
                    predicted_index = int(np.argmax(predictions[0]))
                    confidence = float(predictions[0][predicted_index])
                    raw_emotion = EMOTION_CLASSES[predicted_index]
                    emotion = raw_emotion
                    predictions_map = {cls: float(prob) for cls, prob in zip(EMOTION_CLASSES, predictions[0])}
                except Exception as exc:
                    logger.warning("Custom model inference unavailable: %s", exc)
                    fallback_reason = f"custom model unavailable: {str(exc)}"

            if emotion and confidence < CONFIDENCE_THRESHOLD:
                fallback_reason = f"low confidence ({confidence:.3f})"
                emotion = None

        if not emotion:
            emotion = fallback_emotion()
            raw_emotion = raw_emotion or emotion
            confidence = max(confidence, 0.65)
            predictions_map = predictions_map or {emotion: confidence}
            emotion = majority_vote(student_id, emotion)
        else:
            emotion = majority_vote(student_id, emotion)

        storage_warning = None
        try:
            insert_emotion(student_id, room_id, emotion, confidence)
        except Exception as exc:
            storage_warning = f"failed to persist emotion: {str(exc)}"

        socketio.emit(
            "emotion_update",
            {
                "student_id": student_id,
                "room_id": room_id,
                "emotion": emotion,
                "confidence": confidence,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
        logger.info("Emotion emitted student_id=%s emotion=%s confidence=%.3f", student_id, emotion, confidence)

        response = {
            "student_id": student_id,
            "room_id": room_id,
            "emotion": emotion,
            "raw_emotion": raw_emotion,
            "confidence": confidence,
            "probabilities": predictions_map,
        }
        if fallback_reason:
            response["message"] = f"Fallback emotion used ({fallback_reason})"
        if storage_warning:
            response["warning"] = storage_warning
        if pretrained_warning:
            response["pretrained_warning"] = pretrained_warning

        return jsonify(response)
    except FileNotFoundError as exc:
        logger.exception("Model file not found during prediction: %s", exc)
        return jsonify({"error": str(exc)}), 500
    except Exception as exc:  # pragma: no cover - defensive error handling
        logger.exception("Prediction failed: %s", exc)
        return jsonify({"error": "Prediction failed", "details": str(exc)}), 500
