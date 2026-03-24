"""Prediction endpoint for emotion detection."""
from datetime import datetime, timezone
from collections import Counter, defaultdict, deque
import logging
from flask import Blueprint, request, jsonify
import numpy as np
import cv2

from utils.model import get_emotion_model, predict_with_pretrained
from utils.preprocess import decode_image_bytes, decode_base64_image, crop_face, tensorize_face
from utils.db import insert_emotion, student_exists
from socketio_instance import socketio

predict_bp = Blueprint("predict", __name__)
logger = logging.getLogger(__name__)

EMOTION_CLASSES = ["Engaged", "Confused", "Bored", "Distracted", "Neutral"]
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


@predict_bp.route("/predict", methods=["POST"])
def predict_emotion():
    """Predict emotion from an uploaded image."""
    try:
        logger.info("/predict called")
        student_id_raw = request.form.get("student_id") or (request.json or {}).get("student_id") or "1"
        try:
            student_id = int(student_id_raw)
        except (TypeError, ValueError):
            return jsonify({"error": "student_id must be an integer"}), 400

        image = None
        try:
            if "image" in request.files:
                image_bytes = request.files["image"].read()
                image = decode_image_bytes(image_bytes)
            elif request.json and ("image_base64" in request.json or "image" in request.json):
                image_base64 = request.json.get("image_base64") or request.json.get("image")
                image = decode_base64_image(image_base64)
            else:
                return jsonify({"error": "No image provided."}), 400
        except Exception as exc:
            logger.warning("Invalid image payload: %s", exc)
            return jsonify({"error": "Invalid image payload", "details": str(exc)}), 400

        face_bgr = crop_face(image)
        if face_bgr is None:
            logger.info("No face detected for student_id=%s", student_id)
            return jsonify({
                "student_id": student_id,
                "emotion": "No Face",
                "confidence": 0.0,
                "message": "No face detected. Prediction skipped.",
            })

        if is_spoof_suspected(student_id, face_bgr):
            return jsonify({
                "student_id": student_id,
                "emotion": "Spoof Suspected",
                "confidence": 0.0,
                "message": "Repeated near-identical frames detected. Show a live face with natural movement.",
            })

        raw_emotion = None
        predictions_map = None

        pretrained_warning = None
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
                return jsonify({
                    "student_id": student_id,
                    "emotion": "Unavailable",
                    "confidence": 0.0,
                    "message": "Emotion inference failed. Check model compatibility or keep pretrained detector enabled.",
                    "details": str(exc),
                }), 200

        if confidence < CONFIDENCE_THRESHOLD:
            return jsonify({
                "student_id": student_id,
                "emotion": "Uncertain",
                "confidence": confidence,
                "message": "Low confidence prediction ignored.",
            })

        emotion = majority_vote(student_id, emotion)

        storage_warning = None
        try:
            if student_exists(student_id):
                insert_emotion(student_id, emotion, confidence)
            else:
                storage_warning = f"student_id {student_id} not found in users table; emotion not persisted"
        except Exception as exc:
            storage_warning = f"failed to persist emotion: {str(exc)}"

        socketio.emit(
            "emotion_update",
            {
                "student_id": student_id,
                "emotion": emotion,
                "confidence": confidence,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
        logger.info("Emotion emitted student_id=%s emotion=%s confidence=%.3f", student_id, emotion, confidence)

        response = {
            "student_id": student_id,
            "emotion": emotion,
            "raw_emotion": raw_emotion,
            "confidence": confidence,
            "probabilities": predictions_map,
        }
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
