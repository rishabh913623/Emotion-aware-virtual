import axios from "axios";

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || "http://localhost:3000";
const API = import.meta.env.VITE_AI_API_URL;
const AI_URL = API;

console.log("API URL:", API);

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
  aiClient.defaults.headers.common.Authorization = token ? `Bearer ${token}` : "";
};

export const loginWithBackend = async (email, password) => {
  console.log("LOGIN API:", `${API}/auth/login`);

  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Login failed");
  }

  if (data?.token) {
    localStorage.setItem("token", data.token);
  }

  return data;
};

export const registerWithBackend = async (email, password, extra = {}) => {
  console.log("REGISTER API:", `${API}/auth/register`);

  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password, ...extra })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Register failed");
  }

  return data;
};
