import { io } from "socket.io-client";

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || "http://localhost:3000";
const AI_URL = import.meta.env.VITE_AI_API_URL || "http://localhost:5001";

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
