import { useEffect, useMemo, useState } from "react";
import { aiClient } from "../api/client";

const CAPTURE_MS = 15000;

export const useEmotionCapture = ({ enabled, userId, videoRef }) => {
  const [currentEmotion, setCurrentEmotion] = useState("Waiting");
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");

  const canvas = useMemo(() => document.createElement("canvas"), []);

  useEffect(() => {
    if (!enabled || !videoRef.current) {
      return undefined;
    }

    const capture = () => {
      const video = videoRef.current;
      if (!video?.videoWidth || !video?.videoHeight) {
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          return;
        }

        try {
          const formData = new FormData();
          formData.append("image", blob, "frame.jpg");
          formData.append("student_id", String(userId));

          const response = await aiClient.post("/predict", formData, {
            headers: {
              "Content-Type": "multipart/form-data"
            }
          });

          const emotion = response.data?.emotion || "Unknown";
          setCurrentEmotion(emotion);
          setHistory((prev) => [
            {
              emotion,
              confidence: response.data?.confidence ?? 0,
              timestamp: new Date().toLocaleTimeString()
            },
            ...prev
          ].slice(0, 20));
          setError("");
        } catch (apiError) {
          setError("Emotion capture failed");
        }
      }, "image/jpeg");
    };

    const timer = setInterval(capture, CAPTURE_MS);
    capture();

    return () => clearInterval(timer);
  }, [enabled, userId, videoRef, canvas]);

  return {
    currentEmotion,
    history,
    error
  };
};
