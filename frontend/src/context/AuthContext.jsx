import React, { createContext, useContext, useMemo, useState } from "react";

const STORAGE_KEY = "eavc_auth";
const AuthContext = createContext(null);

const normalizeAuthPayload = (payload) => {
  if (!payload || !payload.token) {
    return null;
  }

  if (payload.user) {
    return payload;
  }

  if (payload.role) {
    return {
      token: payload.token,
      user: {
        id: payload.student_id ?? null,
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
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const logout = () => {
    setAuth(null);
    localStorage.removeItem(STORAGE_KEY);
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
