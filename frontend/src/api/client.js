import axios from "axios";

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || "http://localhost:4000";
const AI_URL = import.meta.env.VITE_AI_API_URL || "http://localhost:5001";

export const signalingClient = axios.create({
  baseURL: SIGNALING_URL,
  timeout: 15000
});

export const aiClient = axios.create({
  baseURL: AI_URL,
  timeout: 15000
});

export const attachAuthToken = (token) => {
  signalingClient.defaults.headers.common.Authorization = token ? `Bearer ${token}` : "";
};
