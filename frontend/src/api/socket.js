import { io } from "socket.io-client";

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || "http://localhost:4000";
const AI_URL = import.meta.env.VITE_AI_API_URL || "http://localhost:5001";

export const createSignalingSocket = (token) => {
  return io(SIGNALING_URL, {
    auth: { token },
    transports: ["websocket", "polling"]
  });
};

export const createAiSocket = () => {
  return io(AI_URL, {
    transports: ["websocket", "polling"]
  });
};
