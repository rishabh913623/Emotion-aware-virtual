"""Model loader for the emotion CNN."""
import os
from functools import lru_cache
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model

try:
    from fer import FER
except ImportError:  # pragma: no cover - optional dependency
    FER = None


EMOTION_GROUP_MAP = {
    "happy": "Engaged",
    "surprise": "Engaged",
    "fear": "Confused",
    "sad": "Bored",
    "angry": "Distracted",
    "disgust": "Distracted",
    "neutral": "Neutral",
}

APP_EMOTIONS = ["Engaged", "Confused", "Bored", "Distracted", "Neutral"]


@lru_cache(maxsize=1)
def get_emotion_model():
    """Load and cache the CNN model."""
    tf.config.threading.set_intra_op_parallelism_threads(
        int(os.getenv("TF_INTRA_THREADS", "0"))
    )
    tf.config.threading.set_inter_op_parallelism_threads(
        int(os.getenv("TF_INTER_THREADS", "0"))
    )
    model_path = os.getenv("MODEL_PATH")
    if not model_path:
        model_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "model", "emotion_model.h5")
        )
    if not os.path.exists(model_path):
        raise FileNotFoundError(
            f"Model file not found at {model_path}. Set MODEL_PATH env var."
        )
    model = load_model(model_path, compile=False)
    warmup_input = np.zeros((1, 48, 48, 1), dtype="float32")
    model.predict(warmup_input)
    return model


@lru_cache(maxsize=1)
def get_pretrained_detector():
    """Load and cache pretrained FER detector when available."""
    if FER is None:
        return None
    return FER(mtcnn=False)


def predict_with_pretrained(face_rgb: np.ndarray):
    """Predict app-level emotion classes using pretrained FER model.

    Returns tuple of (emotion, confidence, grouped_probabilities, raw_probabilities)
    or None when pretrained inference is unavailable.
    """
    detector = get_pretrained_detector()
    if detector is None:
        return None

    detections = detector.detect_emotions(face_rgb)
    if not detections:
        return None

    emotion_scores = detections[0].get("emotions") or {}
    if not emotion_scores:
        return None

    grouped = {label: 0.0 for label in APP_EMOTIONS}
    for raw_label, score in emotion_scores.items():
        grouped_label = EMOTION_GROUP_MAP.get(raw_label, "Neutral")
        grouped[grouped_label] += float(score)

    emotion = max(grouped, key=grouped.get)
    confidence = float(grouped[emotion])
    raw_probabilities = {label: float(score) for label, score in emotion_scores.items()}
    return emotion, confidence, grouped, raw_probabilities
