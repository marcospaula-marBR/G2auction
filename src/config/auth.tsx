import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isDemoSession: boolean;
}

interface AuthResult {
  success: boolean;
  message: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isSupabaseConnected: boolean;
  signInWithMagicLink: (email: string) => Promise<AuthResult>;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signUpWithPassword: (email: string, password: string, name: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signInDemoLocal: (email: string, name?: string) => void;
  signOut: () => Promise<void>;
}

const DEMO_USER_STORAGE_KEY = 'auction_demo_user_v1';

const AuthContext = createContext<AuthContextValue | null>(null);

function loadLocalDemoUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(DEMO_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.email) return parsed as AuthUser;
  } catch {
    // ignore storage errors
  }
  return null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => loadLocalDemoUser());
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      const sbUser = data.session?.user;
      if (sbUser) {
        setUser({
          id: sbUser.id,
          email: sbUser.email || '',
          name:
            (sbUser.user_metadata?.full_name as string) ||
            (sbUser.user_metadata?.name as string) ||
            (sbUser.email ? sbUser.email.split('@')[0] : 'Investidor'),
          isDemoSession: false,
        });
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sbUser = session?.user;
      if (sbUser) {
        try {
          localStorage.removeItem(DEMO_USER_STORAGE_KEY);
        } catch {
          // ignore
        }
        setUser({
          id: sbUser.id,
          email: sbUser.email || '',
          name:
            (sbUser.user_metadata?.full_name as string) ||
            (sbUser.user_metadata?.name as string) ||
            (sbUser.email ? sbUser.email.split('@')[0] : 'Investidor'),
          isDemoSession: false,
        });
      } else {
        setUser(loadLocalDemoUser());
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signInWithMagicLink = useCallback(async (email: string): Promise<AuthResult> => {
    if (!supabase) {
      return {
        success: false,
        message: 'Supabase não configurado no .env. Use o Modo Local (Demo) para testar.',
      };
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
    if (error) {
      return { success: false, message: error.message };
    }
    return {
      success: true,
      message: 'Enviamos um link mágico de acesso para o seu e-mail. Verifique sua caixa de entrada!',
    };
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) {
      return { success: false, message: 'Supabase não configurado no .env.' };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Login realizado com sucesso!' };
  }, []);

  const signUpWithPassword = useCallback(
    async (email: string, password: string, name: string): Promise<AuthResult> => {
      if (!supabase) {
        return { success: false, message: 'Supabase não configurado no .env.' };
      }
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim() },
        },
      });
      if (error) {
        return { success: false, message: error.message };
      }
      return {
        success: true,
        message: 'Conta criada! Caso necessário, confirme o link enviado para o seu e-mail.',
      };
    },
    []
  );

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    if (!supabase) {
      return { success: false, message: 'Supabase não configurado no .env.' };
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Redirecionando para o Google...' };
  }, []);

  const signInDemoLocal = useCallback((email: string, name?: string) => {
    const cleanEmail = email.trim() || 'investidor@demo.local';
    const demoUser: AuthUser = {
      id: `demo-${cleanEmail.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      email: cleanEmail,
      name: (name && name.trim()) || cleanEmail.split('@')[0],
      isDemoSession: true,
    };
    try {
      localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(demoUser));
    } catch {
      // ignore
    }
    setUser(demoUser);
  }, []);

  const signOut = useCallback(async () => {
    try {
      localStorage.removeItem(DEMO_USER_STORAGE_KEY);
    } catch {
      // ignore
    }
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isSupabaseConnected: isSupabaseConfigured,
        signInWithMagicLink,
        signInWithPassword,
        signUpWithPassword,
        signInWithGoogle,
        signInDemoLocal,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser utilizado dentro de AuthProvider');
  }
  return ctx;
}
