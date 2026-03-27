import { useEffect, useMemo, useState } from "react";
import { aiClient } from "../api/client";

const CAPTURE_MS = 4000;

export const useEmotionCapture = ({ enabled, userId, roomId, videoRef }) => {
  const [currentEmotion, setCurrentEmotion] = useState("Waiting");
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");

  const canvas = useMemo(() => document.createElement("canvas"), []);

  useEffect(() => {
    if (!enabled || !userId || !roomId) {
      return undefined;
    }

    const captureFrame = () => {
      const video = videoRef.current;
      if (!video?.videoWidth || !video?.videoHeight) {
        return null;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        return null;
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.8);
    };

    const capture = async () => {
      const imageBase64 = captureFrame();

      try {
        const response = await aiClient.post("/predict", {
          image: imageBase64,
          userId,
          student_id: userId,
          roomId,
          room_id: roomId
        });

        const emotion = response.data?.emotion || "Unknown";
        console.log("[emotion] predict response", response.data);
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
        const message = apiError?.response?.data?.error || apiError?.response?.data?.message || "Emotion capture failed";
        console.error("[emotion] predict error", apiError?.response?.data || apiError);
        setError(message);
      }
    };

    const timer = setInterval(capture, CAPTURE_MS);
    capture();

    return () => clearInterval(timer);
  }, [enabled, userId, roomId, videoRef, canvas]);

  return {
    currentEmotion,
    history,
    error
  };
};
