import { io } from "socket.io-client";

const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

const defaultSignalingUrl = isLocalHost
  ? "http://localhost:3000"
  : "https://emotion-signaling.onrender.com";

const defaultAiApiUrl = isLocalHost
  ? "http://localhost:5001"
  : "https://emotion-ai-backend-rwgf.onrender.com";

const normalizeBaseUrl = (value) => (value || "").replace(/\/$/, "");

const SIGNALING_URL = normalizeBaseUrl(import.meta.env.VITE_SIGNALING_URL || defaultSignalingUrl);
const AI_URL = normalizeBaseUrl(
  import.meta.env.VITE_AI_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    defaultAiApiUrl
);

export const createSignalingSocket = (token) => {
  console.log("[socket] Connecting signaling URL:", SIGNALING_URL);
  const socket = io(SIGNALING_URL, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
    transports: ["websocket", "polling"],
    withCredentials: true
  });

  socket.on("connect", () => {
    console.log("Connected:", socket.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("[socket] Disconnected:", reason);
  });

  socket.on("connect_error", (error) => {
    console.error("[socket] signaling connect_error", error?.message || error);
  });

  return socket;
};

export const createAiSocket = () => {
  return io(AI_URL, {
    reconnection: true,
    reconnectionAttempts: 5,
    timeout: 10000
  });
};
