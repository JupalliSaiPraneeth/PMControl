import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Layout } from './components/Layout.js';
import { Overview } from './pages/Overview.js';
import { Devices } from './pages/Devices.js';
import { RemoteSessionPage } from './pages/RemoteSession.js';
import { SessionHistory } from './pages/SessionHistory.js';
import { Security } from './pages/Security.js';
import { Settings } from './pages/Settings.js';
import { Login } from './pages/Login.js';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Overview />} />
            <Route path="devices" element={<Devices />} />
            <Route path="session" element={<RemoteSessionPage />} />
            <Route path="history" element={<SessionHistory />} />
            <Route path="security" element={<Security />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};
