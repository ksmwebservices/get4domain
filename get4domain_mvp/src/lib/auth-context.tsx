'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { type AuthUser, getSession, clearSession } from './auth';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  logout: () => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: () => {},
  refresh: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    const u = getSession();
    setUser(u);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const logout = () => {
    clearSession();
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
