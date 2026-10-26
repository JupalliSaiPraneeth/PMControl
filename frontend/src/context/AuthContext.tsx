import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api.js';

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, token: string, userId?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore saved auth session
    const savedToken = localStorage.getItem('omnicontrol_token');
    const savedUser = localStorage.getItem('omnicontrol_user');

    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(parsedUser);
        api.setToken(savedToken);
      } catch (e) {
        localStorage.removeItem('omnicontrol_token');
        localStorage.removeItem('omnicontrol_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (email: string, authToken: string, userId?: string) => {
    const id = userId || 'user-' + Math.random().toString(36).substring(2, 8);
    const authUser = { id, email };
    setUser(authUser);
    setToken(authToken);
    api.setToken(authToken);
    localStorage.setItem('omnicontrol_token', authToken);
    localStorage.setItem('omnicontrol_user', JSON.stringify(authUser));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    api.setToken(null);
    localStorage.removeItem('omnicontrol_token');
    localStorage.removeItem('omnicontrol_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
