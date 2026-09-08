import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AuthUser, UserRole } from '../types';
import { defaultUser, defaultJwtToken, safeReadStorage, STORAGE_KEY } from '../data/demoData';
import { signOut } from '../lib/supabase';

interface AuthContextType {
  user: AuthUser | null;
  jwtToken: string | null;
  currentRole: UserRole;
  isAuthModalOpen: boolean;
  isJwtModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  openJwtModal: () => void;
  closeJwtModal: () => void;
  handleAuthSuccess: (user: AuthUser, token?: string) => void;
  handleLogout: () => Promise<void>;
  setCurrentRole: (role: UserRole) => void;
  setUser: React.Dispatch<React.SetStateAction<AuthUser | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() =>
    safeReadStorage<AuthUser | null>(`${STORAGE_KEY}:user`, defaultUser)
  );

  const [jwtToken, setJwtToken] = useState<string | null>(() =>
    safeReadStorage<string | null>(`${STORAGE_KEY}:jwt`, defaultJwtToken)
  );

  const [currentRole, setCurrentRole] = useState<UserRole>(() => user?.role || 'PLANNER');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isJwtModalOpen, setIsJwtModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}:user`, JSON.stringify(user));
    localStorage.setItem(`${STORAGE_KEY}:jwt`, JSON.stringify(jwtToken));
  }, [user, jwtToken]);

  const handleAuthSuccess = (authUser: AuthUser, token?: string) => {
    setUser(authUser);
    if (token) setJwtToken(token);
    setCurrentRole(authUser.role);
    setIsAuthModalOpen(false);
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (e) {
      console.warn('Sign out error:', e);
    }
    setUser(null);
    setJwtToken(null);
    setCurrentRole('PLANNER');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        jwtToken,
        currentRole,
        isAuthModalOpen,
        isJwtModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        openJwtModal: () => setIsJwtModalOpen(true),
        closeJwtModal: () => setIsJwtModalOpen(false),
        handleAuthSuccess,
        handleLogout,
        setCurrentRole,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
