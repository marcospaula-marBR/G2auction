import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isDemoSession: boolean;
}

export interface AuthNotice {
  type: 'success' | 'error';
  text: string;
}

interface AuthResult {
  success: boolean;
  message: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isSupabaseConnected: boolean;
  authNotice: AuthNotice | null;
  clearAuthNotice: () => void;
  signInWithMagicLink: (email: string) => Promise<AuthResult>;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signUpWithPassword: (email: string, password: string, name: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signInDemoLocal: (email: string, name?: string) => void;
  signOut: () => Promise<void>;
}

const DEMO_USER_STORAGE_KEY = 'auction_demo_user_v1';

function formatAuthError(msg: string): string {
  const lower = msg.toLowerCase();
  if (
    lower.includes('error sending confirmation email') ||
    lower.includes('error sending magic link email')
  ) {
    return 'Erro ao enviar e-mail pelo SMTP do Supabase. Confira no painel do Supabase (Authentication → SMTP Settings) se a Porta está em 587 (ou 465), o usuário é o e-mail completo e a senha é uma Senha de App de 16 caracteres do Google.';
  }
  return msg;
}

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
  const [authNotice, setAuthNotice] = useState<AuthNotice | null>(null);
  const arrivedFromAuthLinkRef = useRef<boolean>(false);

  const clearAuthNotice = useCallback(() => setAuthNotice(null), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

    const hasTokenOrCode =
      hashParams.has('access_token') ||
      searchParams.has('code') ||
      hashParams.get('type') === 'signup' ||
      hashParams.get('type') === 'magiclink' ||
      searchParams.get('type') === 'signup' ||
      searchParams.get('type') === 'magiclink';
    if (hasTokenOrCode) {
      arrivedFromAuthLinkRef.current = true;
    }

    const err = searchParams.get('error') || hashParams.get('error');
    const errCode = searchParams.get('error_code') || hashParams.get('error_code') || '';
    const errDesc =
      searchParams.get('error_description') || hashParams.get('error_description') || err || '';

    if (err || errCode || errDesc) {
      const lower = `${errCode} ${errDesc}`.toLowerCase();
      if (errCode === 'otp_expired' || lower.includes('invalid or has expired')) {
        setAuthNotice({
          type: 'error',
          text: 'O link de confirmação expirou ou já foi consumido (muito comum no Outlook/Safe Links ou quando o SMTP do Supabase falha após enviar). Tente entrar novamente ou use E-mail e Senha.',
        });
      } else {
        setAuthNotice({
          type: 'error',
          text: `Não foi possível concluir o login pelo link: ${decodeURIComponent(errDesc.replace(/\+/g, ' '))}`,
        });
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

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

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
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

        const hasUrlToken =
          typeof window !== 'undefined' &&
          (window.location.hash.includes('access_token=') || window.location.search.includes('code='));

        if (event === 'SIGNED_IN' && (arrivedFromAuthLinkRef.current || hasUrlToken)) {
          setAuthNotice({
            type: 'success',
            text: `Login confirmado! Conectado como ${sbUser.email || 'Investidor'}.`,
          });
          arrivedFromAuthLinkRef.current = false;
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
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
      return { success: false, message: formatAuthError(error.message) };
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
      return { success: false, message: formatAuthError(error.message) };
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
      return { success: false, message: formatAuthError(error.message) };
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
        authNotice,
        clearAuthNotice,
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
