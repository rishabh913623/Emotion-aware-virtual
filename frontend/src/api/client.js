import axios from "axios";

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || "http://localhost:3000";
const API = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_AI_API_URL || "http://localhost:5001";
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
  const identifier = (email || "").trim();
  const username = identifier.includes("@") ? identifier.split("@")[0] : identifier;

  console.log("API URL:", API);
  console.log("Login payload:", { email: identifier, password });

  const endpoints = [`${API}/auth/login`, `${API}/login`];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: identifier, password, username })
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 404 && endpoint.endsWith("/auth/login")) {
        continue;
      }

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      if (data?.token) {
        localStorage.setItem("token", data.token);
      }

      return data;
    } catch (err) {
      if (endpoint.endsWith("/auth/login") && err.message === "Failed to fetch") {
        continue;
      }
      console.error("Login error:", err.message);
      throw err;
    }
  }

  const error = new Error("Login failed");
  console.error("Login error:", error.message);
  throw error;
};
