import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { signalingClient, attachAuthToken } from "../api/client";
import { useAuth } from "../context/AuthContext";

const AuthPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "student" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        mode === "login"
          ? { email: form.email, password: form.password }
          : { name: form.name, email: form.email, password: form.password, role: form.role };

      const response = await signalingClient.post(endpoint, payload);
      const authPayload = { token: response.data.token, user: response.data.user };
      login(authPayload);
      attachAuthToken(response.data.token);
      navigate("/classroom");
    } catch (apiError) {
      setError(apiError.response?.data?.error || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-slate-900">Emotion Aware Virtual Classroom</h1>
        <p className="mt-2 text-sm text-slate-500">{mode === "login" ? "Login to continue" : "Create an account"}</p>

        {mode === "register" && (
          <input
            className="mt-4 w-full rounded-lg border border-slate-200 px-4 py-2"
            placeholder="Full Name"
            value={form.name}
            onChange={(event) => handleChange("name", event.target.value)}
            required
          />
        )}

        <input
          className="mt-4 w-full rounded-lg border border-slate-200 px-4 py-2"
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(event) => handleChange("email", event.target.value)}
          required
        />
        <input
          className="mt-4 w-full rounded-lg border border-slate-200 px-4 py-2"
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(event) => handleChange("password", event.target.value)}
          required
        />

        {mode === "register" && (
          <select
            className="mt-4 w-full rounded-lg border border-slate-200 px-4 py-2"
            value={form.role}
            onChange={(event) => handleChange("role", event.target.value)}
          >
            <option value="student">Student</option>
            <option value="instructor">Instructor</option>
          </select>
        )}

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2 text-white"
        >
          {loading ? "Please wait..." : mode === "login" ? "Login" : "Register"}
        </button>

        <button
          type="button"
          onClick={() => setMode((prev) => (prev === "login" ? "register" : "login"))}
          className="mt-3 w-full text-sm text-blue-600"
        >
          {mode === "login" ? "Need an account? Register" : "Already registered? Login"}
        </button>
      </form>
    </div>
  );
};

export default AuthPage;
