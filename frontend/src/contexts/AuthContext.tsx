import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AuthUser, UserRole } from '../types';
import { safeReadStorage, STORAGE_KEY } from '../data/demoData';
import { 
  supabase, 
  getAuthSession, 
  signInWithEmail, 
  signUpWithEmail, 
  signOut, 
  resetPasswordForEmail, 
  updateUserPassword, 
  resendVerificationEmail 
} from '../lib/supabase';

interface AuthContextType {
  user: AuthUser | null;
  jwtToken: string | null;
  currentRole: UserRole;
  isLoading: boolean;
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
  signIn: typeof signInWithEmail;
  signUp: typeof signUpWithEmail;
  resetPassword: typeof resetPasswordForEmail;
  updatePassword: typeof updateUserPassword;
  resendVerification: typeof resendVerificationEmail;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isDemoEnabled = import.meta.env.VITE_ENABLE_DEMO_DATA === 'true';

  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(() =>
    safeReadStorage<AuthUser | null>(`${STORAGE_KEY}:user`, null)
  );

  const [jwtToken, setJwtToken] = useState<string | null>(() =>
    safeReadStorage<string | null>(`${STORAGE_KEY}:jwt`, null)
  );

  // Authoritative role derived directly from verified session; defaults to VIEWER when unauthenticated
  const currentRole: UserRole = user?.role || 'VIEWER';
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isJwtModalOpen, setIsJwtModalOpen] = useState(false);

  // Synchronize with Supabase Auth session & onAuthStateChange events
  useEffect(() => {
    let mounted = true;

    async function initSession() {
      try {
        const session = await getAuthSession();
        if (!mounted) return;

        if (session?.user) {
          const u = session.user;
          const authUser: AuthUser = {
            id: u.id,
            email: u.email || '',
            full_name: (u.user_metadata as any)?.full_name || u.email?.split('@')[0] || 'User',
            role: ((u.user_metadata as any)?.role as UserRole) || 'PLANNER',
            avatar_url: (u.user_metadata as any)?.avatar_url,
          };
          setUser(authUser);
          setJwtToken(session.access_token);
        } else if (!isDemoEnabled) {
          // In production / beta: zero synthetic users when unauthenticated
          setUser(null);
          setJwtToken(null);
        }
      } catch (e) {
        console.warn('[NEXORA] Supabase getSession error:', e);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    initSession();

    // Listen to real-time auth lifecycle (SIGN_IN, TOKEN_REFRESHED, USER_UPDATED, SIGN_OUT, PASSWORD_RECOVERY)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          const u = session.user;
          const authUser: AuthUser = {
            id: u.id,
            email: u.email || '',
            full_name: (u.user_metadata as any)?.full_name || u.email?.split('@')[0] || 'User',
            role: ((u.user_metadata as any)?.role as UserRole) || 'PLANNER',
            avatar_url: (u.user_metadata as any)?.avatar_url,
          };
          setUser(authUser);
          setJwtToken(session.access_token);
        }
      } else if (event === 'SIGNED_OUT') {
        if (!isDemoEnabled) {
          setUser(null);
          setJwtToken(null);
        }
      }
    });

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [isDemoEnabled]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(`${STORAGE_KEY}:user`, JSON.stringify(user));
    } else {
      localStorage.removeItem(`${STORAGE_KEY}:user`);
    }
    if (jwtToken) {
      localStorage.setItem(`${STORAGE_KEY}:jwt`, JSON.stringify(jwtToken));
    } else {
      localStorage.removeItem(`${STORAGE_KEY}:jwt`);
    }
  }, [user, jwtToken]);

  const handleAuthSuccess = (authUser: AuthUser, token?: string) => {
    setUser(authUser);
    if (token) setJwtToken(token);
    setIsAuthModalOpen(false);
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (e) {
      console.warn('[NEXORA] Sign out error:', e);
    }
    localStorage.removeItem(`${STORAGE_KEY}:user`);
    localStorage.removeItem(`${STORAGE_KEY}:jwt`);
    setUser(null);
    setJwtToken(null);
  };

  const setCurrentRole = (role: UserRole) => {
    if (user) {
      setUser({ ...user, role });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        jwtToken,
        currentRole,
        isLoading,
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
        signIn: signInWithEmail,
        signUp: signUpWithEmail,
        resetPassword: resetPasswordForEmail,
        updatePassword: updateUserPassword,
        resendVerification: resendVerificationEmail,
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
