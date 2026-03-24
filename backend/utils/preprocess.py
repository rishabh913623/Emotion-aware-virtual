"""Image preprocessing helpers for the emotion CNN."""
import base64
from functools import lru_cache
import numpy as np
import cv2


def decode_image_bytes(image_bytes: bytes) -> np.ndarray:
    """Decode raw bytes into a BGR image array."""
    image_array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Unable to decode image bytes.")
    return image


def decode_base64_image(encoded: str) -> np.ndarray:
    """Decode base64 string into a BGR image array."""
    if "," in encoded:
        encoded = encoded.split(",", 1)[1]
    image_bytes = base64.b64decode(encoded)
    return decode_image_bytes(image_bytes)


@lru_cache(maxsize=1)
def get_face_cascade() -> cv2.CascadeClassifier:
    """Load Haar cascade classifier for face detection."""
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    cascade = cv2.CascadeClassifier(cascade_path)
    if cascade.empty():
        raise FileNotFoundError("Failed to load Haar cascade for face detection.")
    return cascade


def crop_face(image_bgr: np.ndarray) -> np.ndarray | None:
    """Detect and crop the largest face; return None when no face is found."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    cascade = get_face_cascade()
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    if len(faces) == 0:
        return None

    x, y, w, h = max(faces, key=lambda rect: rect[2] * rect[3])
    return image_bgr[y : y + h, x : x + w]


def preprocess_for_model(image_bgr: np.ndarray) -> tuple[np.ndarray | None, bool]:
    """Convert BGR image to model-ready tensor (1, 48, 48, 1)."""
    face_bgr = crop_face(image_bgr)
    if face_bgr is None:
        return None, False

    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, (48, 48))
    normalized = resized.astype("float32") / 255.0
    tensor = np.expand_dims(normalized, axis=(0, -1))
    return tensor, True
