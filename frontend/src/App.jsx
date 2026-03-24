import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./context/AuthContext";
import AuthPage from "./pages/AuthPage";
import ClassroomPage from "./pages/ClassroomPage";
import DashboardPage from "./pages/DashboardPage";

const ProtectedRoute = ({ children }) => {
  const { auth } = useAuth();
  if (!auth?.token || !auth?.user || auth.user.id === null || auth.user.id === undefined) {
    return <Navigate to="/auth" replace />;
  }
  return children;
};

const App = () => {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/classroom"
        element={
          <ProtectedRoute>
            <ClassroomPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/classroom" replace />} />
    </Routes>
  );
};

export default App;
