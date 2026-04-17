import { useEffect, useRef } from "react";
import { aiClient } from "../api/client";
import { faceapi, loadFaceApiModels, getEmotionDetectionIntervalMs } from "../utils/faceApiModels";

const formatEmotion = (emotion) => {
  const value = String(emotion || "").trim();
  if (!value) {
    return "Unknown";
  }
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

const getTopExpression = (expressions = {}) => {
  const entries = Object.entries(expressions);
  if (!entries.length) {
    return ["Unknown", 0];
  }
  return entries.sort((left, right) => right[1] - left[1])[0];
};

const drawOverlay = ({ overlay, video, detection, emotion, confidence }) => {
  const context = overlay.getContext("2d");
  if (!context) {
    return;
  }

  const displayWidth = video.videoWidth;
  const displayHeight = video.videoHeight;

  if (!displayWidth || !displayHeight) {
    return;
  }

  overlay.width = displayWidth;
  overlay.height = displayHeight;

  context.clearRect(0, 0, displayWidth, displayHeight);

  if (!detection?.box) {
    return;
  }

  const { x, y, width, height } = detection.box;

  context.strokeStyle = "#22c55e";
  context.lineWidth = 2;
  context.strokeRect(x, y, width, height);

  const text = `${emotion} (${Math.round(confidence * 100)}%)`;
  context.font = "16px Inter, sans-serif";
  const textPadding = 6;
  const textWidth = context.measureText(text).width;
  const textX = Math.max(0, x);
  const textY = Math.max(22, y - 8);

  context.fillStyle = "rgba(15, 23, 42, 0.85)";
  context.fillRect(textX - textPadding, textY - 18, textWidth + textPadding * 2, 22);

  context.fillStyle = "#ffffff";
  context.fillText(text, textX, textY - 2);
};

export const useEmotionDetection = ({ enabled, videoRef, studentId, roomId, intervalMs, onDetection, onError }) => {
  const overlayRef = useRef(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!enabled || !videoRef?.current || !studentId) {
      return undefined;
    }

    let cancelled = false;
    const effectiveIntervalMs = getEmotionDetectionIntervalMs(intervalMs);

    const runDetection = async () => {
      if (cancelled || busyRef.current) {
        return;
      }

      const video = videoRef.current;
      const overlay = overlayRef.current;
      if (!video || !overlay || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        return;
      }

      busyRef.current = true;

      try {
        // Pretrained model load + inference happens on interval, not per frame.
        await loadFaceApiModels();

        const result = await faceapi
          .detectSingleFace(
            video,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 224,
              scoreThreshold: 0.4
            })
          )
          .withFaceExpressions();

        if (!result) {
          drawOverlay({ overlay, video, detection: null, emotion: "", confidence: 0 });
          return;
        }

        const [rawEmotion, confidenceRaw] = getTopExpression(result.expressions);
        const emotion = formatEmotion(rawEmotion);
        const confidence = Number(confidenceRaw || 0);
        const timestamp = new Date().toISOString();

        drawOverlay({ overlay, video, detection: result.detection, emotion, confidence });

        const payload = {
          student_id: String(studentId),
          room_id: roomId,
          timestamp,
          emotion,
          confidence: Number(confidence.toFixed(4))
        };

        // Metadata-only payload, no image/video sent to backend.
        await aiClient.post("/emotion-data", payload);
        onDetection?.(payload);
      } catch (error) {
        onError?.(error?.response?.data?.error || "Emotion detection failed");
      } finally {
        busyRef.current = false;
      }
    };

    const timer = setInterval(runDetection, effectiveIntervalMs);
    runDetection();

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, videoRef, studentId, roomId, intervalMs, onDetection, onError]);

  return { overlayRef };
};
