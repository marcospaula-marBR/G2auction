import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export type AccountRole = 'investor' | 'partner';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  accountRole: AccountRole;
  partnerCategory?: string;
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
  signInWithMagicLink: (email: string, role?: AccountRole, partnerCategory?: string) => Promise<AuthResult>;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signUpWithPassword: (
    email: string,
    password: string,
    name: string,
    role?: AccountRole,
    partnerCategory?: string
  ) => Promise<AuthResult>;
  signInWithGoogle: (role?: AccountRole, partnerCategory?: string) => Promise<AuthResult>;
  signInDemoLocal: (email: string, name?: string, role?: AccountRole, partnerCategory?: string) => void;
  switchAccountRole: (role: AccountRole) => Promise<void>;
  signOut: () => Promise<void>;
}

const DEMO_USER_STORAGE_KEY = 'auction_demo_user_v1';
const PENDING_ROLE_STORAGE_KEY = 'auction_pending_role_v1';
const DEFAULT_G2_TENANT_ID = '00000000-0000-4000-8000-000000000002';

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

function savePendingRole(role: AccountRole, partnerCategory?: string) {
  try {
    localStorage.setItem(
      PENDING_ROLE_STORAGE_KEY,
      JSON.stringify({ role, category: partnerCategory || null, ts: Date.now() })
    );
  } catch {
    // ignore
  }
}

function readPendingRole(): { role: AccountRole; category?: string } | null {
  try {
    const raw = localStorage.getItem(PENDING_ROLE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.role === 'partner' || parsed?.role === 'investor') {
      return {
        role: parsed.role,
        category: typeof parsed.category === 'string' ? parsed.category : undefined,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

function clearPendingRole() {
  try {
    localStorage.removeItem(PENDING_ROLE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

async function syncRoleMembership(userId: string, role: AccountRole) {
  if (!supabase || !userId) return;
  try {
    await supabase.from('tenant_members').upsert(
      {
        tenant_id: DEFAULT_G2_TENANT_ID,
        user_id: userId,
        role,
      },
      { onConflict: 'tenant_id,user_id' }
    );
  } catch {
    // best-effort sync
  }
}

function buildAuthUserFromSupabase(
  sbUser: { id: string; email?: string; user_metadata?: Record<string, any> },
  overrideRole?: AccountRole,
  overrideCategory?: string
): AuthUser {
  const metaRole = sbUser.user_metadata?.account_type === 'partner' ? 'partner' : 'investor';
  const accountRole = overrideRole || metaRole;
  const partnerCategory =
    overrideCategory ||
    (typeof sbUser.user_metadata?.partner_category === 'string'
      ? sbUser.user_metadata.partner_category
      : undefined);

  return {
    id: sbUser.id,
    email: sbUser.email || '',
    name:
      (sbUser.user_metadata?.full_name as string) ||
      (sbUser.user_metadata?.name as string) ||
      (sbUser.email ? sbUser.email.split('@')[0] : accountRole === 'partner' ? 'Parceiro' : 'Investidor'),
    accountRole,
    partnerCategory,
    isDemoSession: false,
  };
}

function loadLocalDemoUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(DEMO_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.email) {
      return {
        ...parsed,
        accountRole: parsed.accountRole === 'partner' ? 'partner' : 'investor',
      } as AuthUser;
    }
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
    const client = supabase;
    let isMounted = true;

    client.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      const sbUser = data.session?.user;
      if (sbUser) {
        const pending = readPendingRole();
        const resolved = buildAuthUserFromSupabase(sbUser, pending?.role, pending?.category);
        setUser(resolved);
      }
      setLoading(false);
    });

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      const sbUser = session?.user;
      if (sbUser) {
        try {
          localStorage.removeItem(DEMO_USER_STORAGE_KEY);
        } catch {
          // ignore
        }

        const pending = readPendingRole();
        const metaRole: AccountRole =
          sbUser.user_metadata?.account_type === 'partner' ? 'partner' : 'investor';
        const effectiveRole: AccountRole = pending?.role || metaRole;
        const effectiveCategory =
          pending?.category ||
          (typeof sbUser.user_metadata?.partner_category === 'string'
            ? sbUser.user_metadata.partner_category
            : undefined);

        const resolvedUser = buildAuthUserFromSupabase(sbUser, effectiveRole, effectiveCategory);
        setUser(resolvedUser);

        if (pending && (pending.role !== metaRole || (pending.category && pending.category !== sbUser.user_metadata?.partner_category))) {
          client.auth
            .updateUser({
              data: {
                account_type: effectiveRole,
                ...(effectiveCategory ? { partner_category: effectiveCategory } : {}),
              },
            })
            .catch(() => {});
        }
        clearPendingRole();

        if (event === 'SIGNED_IN') {
          syncRoleMembership(sbUser.id, effectiveRole);
        }

        const hasUrlToken =
          typeof window !== 'undefined' &&
          (window.location.hash.includes('access_token=') || window.location.search.includes('code='));

        if (event === 'SIGNED_IN' && (arrivedFromAuthLinkRef.current || hasUrlToken)) {
          const perfilLabel = effectiveRole === 'partner' ? 'Parceiro' : 'Investidor';
          setAuthNotice({
            type: 'success',
            text: `Login confirmado (${perfilLabel})! Conectado como ${sbUser.email || perfilLabel}.`,
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

  const signInWithMagicLink = useCallback(
    async (
      email: string,
      role: AccountRole = 'investor',
      partnerCategory?: string
    ): Promise<AuthResult> => {
      if (!supabase) {
        return {
          success: false,
          message: 'Supabase não configurado no .env. Use o Modo Local (Demo) para testar.',
        };
      }
      savePendingRole(role, role === 'partner' ? partnerCategory : undefined);
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
          data: {
            account_type: role,
            ...(role === 'partner' && partnerCategory ? { partner_category: partnerCategory } : {}),
          },
        },
      });
      if (error) {
        clearPendingRole();
        return { success: false, message: formatAuthError(error.message) };
      }
      return {
        success: true,
        message: `Enviamos um link mágico de acesso (${role === 'partner' ? 'Parceiro' : 'Investidor'}) para o seu e-mail. Verifique sua caixa de entrada!`,
      };
    },
    []
  );

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
    async (
      email: string,
      password: string,
      name: string,
      role: AccountRole = 'investor',
      partnerCategory?: string
    ): Promise<AuthResult> => {
      if (!supabase) {
        return { success: false, message: 'Supabase não configurado no .env.' };
      }
      savePendingRole(role, role === 'partner' ? partnerCategory : undefined);
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
            account_type: role,
            ...(role === 'partner' && partnerCategory ? { partner_category: partnerCategory } : {}),
          },
        },
      });
      if (error) {
        clearPendingRole();
        return { success: false, message: formatAuthError(error.message) };
      }
      return {
        success: true,
        message: 'Conta criada! Caso necessário, confirme o link enviado para o seu e-mail.',
      };
    },
    []
  );

  const signInWithGoogle = useCallback(
    async (role: AccountRole = 'investor', partnerCategory?: string): Promise<AuthResult> => {
      if (!supabase) {
        return { success: false, message: 'Supabase não configurado no .env.' };
      }
      savePendingRole(role, role === 'partner' ? partnerCategory : undefined);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });
      if (error) {
        clearPendingRole();
        return { success: false, message: formatAuthError(error.message) };
      }
      return { success: true, message: 'Redirecionando para o Google...' };
    },
    []
  );

  const signInDemoLocal = useCallback(
    (email: string, name?: string, role: AccountRole = 'investor', partnerCategory?: string) => {
      const cleanEmail = email.trim() || (role === 'partner' ? 'parceiro@demo.local' : 'investidor@demo.local');
      const demoUser: AuthUser = {
        id: `demo-${cleanEmail.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        email: cleanEmail,
        name: (name && name.trim()) || cleanEmail.split('@')[0],
        accountRole: role,
        partnerCategory: role === 'partner' ? partnerCategory : undefined,
        isDemoSession: true,
      };
      try {
        localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(demoUser));
      } catch {
        // ignore
      }
      setUser(demoUser);
    },
    []
  );

  const switchAccountRole = useCallback(async (role: AccountRole) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, accountRole: role };
      if (prev.isDemoSession) {
        try {
          localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return next;
    });

    if (supabase) {
      try {
        const { data } = await supabase.auth.updateUser({
          data: { account_type: role },
        });
        if (data?.user?.id) {
          await syncRoleMembership(data.user.id, role);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    clearPendingRole();
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
        switchAccountRole,
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
