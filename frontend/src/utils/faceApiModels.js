import * as faceapi from "face-api.js";

let modelLoadPromise = null;

const DEFAULT_MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";

const normalizeModelUrl = (url) => (url || "").replace(/\/$/, "");

export const getEmotionDetectionIntervalMs = () => {
  const raw = Number(import.meta.env.VITE_EMOTION_DETECTION_INTERVAL_MS || 15000);
  if (Number.isNaN(raw)) {
    return 15000;
  }
  return Math.min(20000, Math.max(10000, raw));
};

export const loadFaceApiModels = async () => {
  // Shared singleton loader so 20-50 tiles don't trigger duplicate model downloads.
  if (!modelLoadPromise) {
    const modelUrl = normalizeModelUrl(import.meta.env.VITE_FACE_API_MODEL_URL || DEFAULT_MODEL_URL);
    modelLoadPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
      faceapi.nets.faceExpressionNet.loadFromUri(modelUrl)
    ]);
  }

  await modelLoadPromise;
};

export { faceapi };
