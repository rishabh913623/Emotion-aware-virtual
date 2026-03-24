import React, { useEffect, useRef, useState } from "react";
import apiClient from "../api/client.js";

const CAPTURE_INTERVAL_MS = 15000;

const WebcamFeed = ({ studentId, onEmotionDetected }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("Initializing camera...");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    let stream;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsStreaming(true);
          setStatus("Camera ready");
        }
      } catch (error) {
        setStatus("Camera access denied or unavailable.");
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!isStreaming) {
      return undefined;
    }

    const intervalId = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext("2d");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          return;
        }

        try {
          setIsSending(true);
          const formData = new FormData();
          formData.append("image", blob, "frame.jpg");
          formData.append("student_id", studentId);

          const response = await apiClient.post("/predict", formData, {
            headers: { "Content-Type": "multipart/form-data" }
          });

          const emotion = response.data?.emotion || "Unknown";
          onEmotionDetected(emotion);
          setStatus("Last updated: " + new Date().toLocaleTimeString());
        } catch (error) {
          setStatus("Prediction failed. Check backend.");
        } finally {
          setIsSending(false);
        }
      }, "image/jpeg");
    }, CAPTURE_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isStreaming, onEmotionDetected, studentId]);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Student Camera</h2>
        {isSending && (
          <span className="text-xs font-medium text-blue-600">Sending...</span>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-500">{status}</p>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="mt-4 w-full rounded-xl bg-slate-900"
      />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default WebcamFeed;
