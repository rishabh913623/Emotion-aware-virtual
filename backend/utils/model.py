"""Model loader for the emotion CNN."""
import os
from functools import lru_cache
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model


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
