import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as authService from '@/services/auth';

export type UserRole = 'ceo' | 'rep';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarColor: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string) => Promise<{
    success: boolean;
    error?: string;
    pendingApproval?: boolean;
    message?: string;
  }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  signup: async () => ({ success: false as const }),
  logout: () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const restore = async () => {
      const token = authService.getStoredToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const result = await authService.getMe();
      if (result.success && result.user) {
        setUser(result.user as User);
      } else {
        authService.clearToken();
      }
      setLoading(false);
    };

    restore();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authService.login(email, password);
    if (result.success && result.user) {
      setUser(result.user as User);
      return { success: true };
    }
    return { success: false, error: result.error };
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    const result = await authService.signup(email, password, name);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    // Pending approval — do not log the user in
    if (result.pendingApproval) {
      return { success: true, pendingApproval: true, message: result.message };
    }
    if (result.user) {
      setUser(result.user as User);
    }
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    authService.clearToken();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const result = await authService.getMe();
    if (result.success && result.user) {
      setUser(result.user as User);
    } else {
      authService.clearToken();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
