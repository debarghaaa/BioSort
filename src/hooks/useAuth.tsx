import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from '../services/supabase/client';
import { UserRole } from '../types/platform';
import {
  parseConfiguredOAuthProviders,
  type OAuthProviderConfig,
  type SupportedOAuthProvider,
} from '../utils/authValidation';

const LOCAL_SESSION_KEY = 'medwaste_foundation_session_v1';

const runtimeEnv = (import.meta as { env?: Record<string, string | undefined> }).env;

export function getConfiguredOAuthProviders(): OAuthProviderConfig[] {
  return parseConfiguredOAuthProviders(
    runtimeEnv?.VITE_SUPABASE_OAUTH_PROVIDERS,
    isSupabaseConfigured
  );
}

export interface AuthState {
  initialized: boolean;
  isAuthenticated: boolean;
  authMode: 'supabase' | 'foundation' | 'guest';
  userId: string | null;
  email: string | null;
  role: UserRole;
  accessToken: string | null;
  isRecoverySession: boolean;
  initError: string | null;
}

export interface SignUpResult {
  requiresEmailConfirmation: boolean;
}

interface AuthContextValue {
  auth: AuthState;
  signInWithSupabase: (email: string, password: string) => Promise<void>;
  signUpWithSupabase: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<SignUpResult>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  updatePasswordWithSupabase: (newPassword: string) => Promise<void>;
  signInWithOAuth: (provider: SupportedOAuthProvider) => Promise<void>;
  enterFoundationSession: (role: UserRole) => void;
  enterGuestSession: () => void;
  logout: () => Promise<void>;
  retryInitialization: () => Promise<void>;
  clearInitError: () => void;
  hasRole: (allowed: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface StoredLocalSession {
  mode?: 'foundation' | 'guest';
  role?: UserRole;
}

function loadLocalSession(allowedModes: Array<'foundation' | 'guest'>): AuthState | null {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLocalSession;
    const mode = parsed.mode ?? 'foundation';
    if (!allowedModes.includes(mode)) {
      return null;
    }

    if (mode === 'guest') {
      return {
        initialized: true,
        isAuthenticated: true,
        authMode: 'guest',
        userId: 'guest-operator',
        email: 'guest@workspace.local',
        role: UserRole.ADMIN,
        accessToken: null,
        isRecoverySession: false,
        initError: null,
      };
    }

    if (!parsed.role || !Object.values(UserRole).includes(parsed.role)) {
      return null;
    }
    return {
      initialized: true,
      isAuthenticated: true,
      authMode: 'foundation',
      userId: `foundation-${parsed.role}`,
      email: `${parsed.role}@foundation.local`,
      role: parsed.role,
      accessToken: null,
      isRecoverySession: false,
      initError: null,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => {
    if (!isSupabaseConfigured) {
      const saved = loadLocalSession(['foundation', 'guest']);
      if (saved) return saved;
      return {
        initialized: true,
        isAuthenticated: false,
        authMode: 'foundation',
        userId: null,
        email: null,
        role: UserRole.OPERATOR,
        accessToken: null,
        isRecoverySession: false,
        initError: null,
      };
    }
    const savedGuest = loadLocalSession(['guest']);
    if (savedGuest) return savedGuest;
    return {
      initialized: false,
      isAuthenticated: false,
      authMode: 'supabase',
      userId: null,
      email: null,
      role: UserRole.OPERATOR,
      accessToken: null,
      isRecoverySession: false,
      initError: null,
    };
  });

  const resolveSession = useCallback(
    async (
      session: { user: { id: string; email?: string }; access_token: string } | null,
      event?: string,
      isActive: () => boolean = () => true
    ) => {
      const supabase = getSupabaseClient();
      if (!session || !supabase) {
        const guestSession = loadLocalSession(['guest']);
        if (!isActive()) return;
        if (guestSession) {
          setAuth(guestSession);
          return;
        }
        setAuth({
          initialized: true,
          isAuthenticated: false,
          authMode: isSupabaseConfigured ? 'supabase' : 'foundation',
          userId: null,
          email: null,
          role: UserRole.OPERATOR,
          accessToken: null,
          isRecoverySession: false,
          initError: null,
        });
        return;
      }

      localStorage.removeItem(LOCAL_SESSION_KEY);

      let resolvedRole = UserRole.OPERATOR;
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile?.role && Object.values(UserRole).includes(profile.role as UserRole)) {
          resolvedRole = profile.role as UserRole;
        }
      } catch {
        resolvedRole = UserRole.OPERATOR;
      }

      if (!isActive()) return;

      setAuth((prev) => ({
        initialized: true,
        isAuthenticated: true,
        authMode: 'supabase',
        userId: session.user.id,
        email: session.user.email ?? null,
        role: resolvedRole,
        accessToken: session.access_token,
        isRecoverySession:
          event === 'PASSWORD_RECOVERY'
            ? true
            : event === 'USER_UPDATED' || event === 'SIGNED_OUT'
              ? false
              : prev.isRecoverySession,
        initError: null,
      }));
    },
    []
  );

  const restoreSession = useCallback(
    async (isActive: () => boolean = () => true) => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        if (!isActive()) return;
        setAuth((prev) => ({
          ...prev,
          initialized: true,
          initError: null,
        }));
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw new Error(error.message);
        }
        await resolveSession(data.session, undefined, isActive);
      } catch (err) {
        if (!isActive()) return;
        const guestSession = loadLocalSession(['guest']);
        if (guestSession) {
          setAuth(guestSession);
          return;
        }
        setAuth({
          initialized: true,
          isAuthenticated: false,
          authMode: 'supabase',
          userId: null,
          email: null,
          role: UserRole.OPERATOR,
          accessToken: null,
          isRecoverySession: false,
          initError:
            err instanceof Error
              ? err.message
              : 'Unable to restore workspace authentication session.',
        });
      }
    },
    [resolveSession]
  );

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    let active = true;
    const isActive = () => active;

    void restoreSession(isActive);

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      void resolveSession(session, event, isActive);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [resolveSession, restoreSession]);

  const signInWithSupabase = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error(
        'Supabase Auth is not configured in this environment. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY or use Foundation / Guest Mode.'
      );
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const signUpWithSupabase = useCallback(
    async (email: string, password: string, displayName?: string): Promise<SignUpResult> => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error(
          'Supabase Auth is not configured in this environment. Account registration requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
        );
      }
      const trimmedName = displayName?.trim();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: trimmedName ? { display_name: trimmedName } : undefined,
        },
      });
      if (error) {
        throw new Error(error.message);
      }
      return {
        requiresEmailConfirmation: Boolean(data.user && !data.session),
      };
    },
    []
  );

  const resetPasswordForEmail = useCallback(async (email: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error(
        'Password recovery requires Supabase Auth environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).'
      );
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const updatePasswordWithSupabase = useCallback(async (newPassword: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase Auth is not configured in this environment.');
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      throw new Error(error.message);
    }
    setAuth((prev) => ({ ...prev, isRecoverySession: false }));
  }, []);

  const signInWithOAuth = useCallback(async (provider: SupportedOAuthProvider) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase Auth is not configured in this environment.');
    }
    const configured = getConfiguredOAuthProviders();
    if (!configured.some((item) => item.id === provider)) {
      throw new Error(`OAuth provider "${provider}" is not configured for this workspace.`);
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const enterFoundationSession = useCallback((role: UserRole) => {
    if (isSupabaseConfigured) return;
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ mode: 'foundation', role }));
    setAuth({
      initialized: true,
      isAuthenticated: true,
      authMode: 'foundation',
      userId: `foundation-${role}`,
      email: `${role}@foundation.local`,
      role,
      accessToken: null,
      isRecoverySession: false,
      initError: null,
    });
  }, []);

  const enterGuestSession = useCallback(() => {
    localStorage.setItem(
      LOCAL_SESSION_KEY,
      JSON.stringify({ mode: 'guest', role: UserRole.ADMIN })
    );
    setAuth({
      initialized: true,
      isAuthenticated: true,
      authMode: 'guest',
      userId: 'guest-operator',
      email: 'guest@workspace.local',
      role: UserRole.ADMIN,
      accessToken: null,
      isRecoverySession: false,
      initError: null,
    });
  }, []);

  const logout = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(LOCAL_SESSION_KEY);
    setAuth({
      initialized: true,
      isAuthenticated: false,
      authMode: isSupabaseConfigured ? 'supabase' : 'foundation',
      userId: null,
      email: null,
      role: UserRole.OPERATOR,
      accessToken: null,
      isRecoverySession: false,
      initError: null,
    });
  }, []);

  const retryInitialization = useCallback(async () => {
    setAuth((prev) => ({
      ...prev,
      initialized: false,
      initError: null,
    }));
    await restoreSession();
  }, [restoreSession]);

  const clearInitError = useCallback(() => {
    setAuth((prev) => ({
      ...prev,
      initialized: true,
      initError: null,
    }));
  }, []);

  const hasRole = useCallback(
    (allowed: UserRole[]) => auth.isAuthenticated && allowed.includes(auth.role),
    [auth.isAuthenticated, auth.role]
  );

  return (
    <AuthContext.Provider
      value={{
        auth,
        signInWithSupabase,
        signUpWithSupabase,
        resetPasswordForEmail,
        updatePasswordWithSupabase,
        signInWithOAuth,
        enterFoundationSession,
        enterGuestSession,
        logout,
        retryInitialization,
        clearInitError,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
