import React, { useState } from "react";
import apiClient, { setStoredAuth } from "../api/client.js";

const LoginForm = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setStatus("");

    try {
      const response = await apiClient.post("/login", { username, password });
      setStoredAuth(response.data);
      onLogin(response.data);
    } catch (error) {
      setStatus("Invalid username or password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg"
      >
        <h1 className="text-2xl font-semibold text-slate-900">Emotion Classroom</h1>
        <p className="mt-2 text-sm text-slate-500">Login as student or instructor</p>

        <div className="mt-6 space-y-4">
          <input
            className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-blue-500 focus:outline-none"
            placeholder="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-blue-500 focus:outline-none"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        {status && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {status}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {isLoading ? "Signing in..." : "Login"}
        </button>

        <div className="mt-4 text-xs text-slate-500">
          <p>Student: student / student123</p>
          <p>Instructor: instructor / instructor123</p>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;
