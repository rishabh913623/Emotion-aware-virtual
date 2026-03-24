import { io } from "socket.io-client";

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || "http://localhost:4000";
const AI_URL = import.meta.env.VITE_AI_API_URL || "http://localhost:5001";

export const createSignalingSocket = (token) => {
  return io(SIGNALING_URL, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 5,
    timeout: 10000
  });
};

export const createAiSocket = () => {
  return io(AI_URL, {
    reconnection: true,
    reconnectionAttempts: 5,
    timeout: 10000
  });
};
