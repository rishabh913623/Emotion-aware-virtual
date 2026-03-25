import React, { createContext, useContext, useMemo, useState } from "react";

const STORAGE_KEY = "eavc_auth";
const AuthContext = createContext(null);

const normalizeAuthPayload = (payload) => {
  if (!payload || !payload.token) {
    return null;
  }

  const resolveUserId = (value) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const numeric = Number(value);
    return Number.isNaN(numeric) ? value : numeric;
  };

  if (payload.user) {
    const userId = resolveUserId(
      payload.user.id ?? payload.user.user_id ?? payload.user.student_id ?? payload.id ?? payload.userId
    );
    return {
      token: payload.token,
      user: {
        ...payload.user,
        id: userId
      }
    };
  }

  if (payload.role) {
    return {
      token: payload.token,
      user: {
        id: resolveUserId(payload.id ?? payload.user_id ?? payload.student_id ?? payload.userId),
        name: payload.username ?? "User",
        email: payload.email ?? "",
        role: payload.role
      }
    };
  }

  return null;
};

const readStorage = () => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? normalizeAuthPayload(JSON.parse(value)) : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(readStorage);

  const login = (payload) => {
    const normalized = normalizeAuthPayload(payload);
    setAuth(normalized);
    if (normalized) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      localStorage.setItem("token", normalized.token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("token");
    }
  };

  const logout = () => {
    setAuth(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("token");
  };

  const value = useMemo(() => ({ auth, login, logout }), [auth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};
