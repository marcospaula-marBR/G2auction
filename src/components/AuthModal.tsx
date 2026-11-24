import React, { useState } from 'react';
import { X, Mail, Lock, Sparkles, ShieldCheck, AlertCircle, CheckCircle2, User } from 'lucide-react';
import { useAuth } from '../config/auth';
import { useTenant } from '../config/tenant';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { tenant } = useTenant();
  const {
    isSupabaseConnected,
    signInWithMagicLink,
    signInWithPassword,
    signUpWithPassword,
    signInWithGoogle,
    signInDemoLocal,
  } = useAuth();

  const [mode, setMode] = useState<'magic' | 'password'>('magic');
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setFeedback(null);

    try {
      if (!isSupabaseConnected) {
        signInDemoLocal(email, name);
        onClose();
        return;
      }

      if (mode === 'magic') {
        const res = await signInWithMagicLink(email);
        setFeedback({ type: res.success ? 'success' : 'error', text: res.message });
      } else if (isSignUp) {
        const res = await signUpWithPassword(email, password, name);
        setFeedback({ type: res.success ? 'success' : 'error', text: res.message });
      } else {
        const res = await signInWithPassword(email, password);
        if (res.success) {
          onClose();
        } else {
          setFeedback({ type: 'error', text: res.message });
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    setFeedback(null);
    const res = await signInWithGoogle();
    if (!res.success) {
      setFeedback({ type: 'error', text: res.message });
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 block">
              Acesso do Investidor • {tenant.brandName}
            </span>
            <h2 className="text-base font-black text-white">Entrar ou Criar Conta</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {!isSupabaseConnected && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-2xl space-y-1.5">
              <div className="font-black flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Supabase Auth aguardando variáveis no .env</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Ao adicionar <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no <code>.env</code>, o login real (Magic Link / Google) ativa automaticamente. Enquanto isso, entre abaixo no <strong>Modo Local</strong> para salvar seu Radar IA e testar notificações.
              </p>
            </div>
          )}

          {/* Seletor de Modo */}
          {isSupabaseConnected && (
            <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setMode('magic');
                  setFeedback(null);
                }}
                className={`py-2 rounded-lg font-bold transition-all ${
                  mode === 'magic' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Magic Link (Sem Senha)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('password');
                  setFeedback(null);
                }}
                className={`py-2 rounded-lg font-bold transition-all ${
                  mode === 'password' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                }`}
              >
                E-mail e Senha
              </button>
            </div>
          )}

          {feedback && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <span className="font-medium leading-relaxed">{feedback.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {(!isSupabaseConnected || (mode === 'password' && isSignUp)) && (
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Seu Nome</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Carlos Eduardo"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 font-medium"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">E-mail</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="investidor@email.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 font-bold"
                />
              </div>
            </div>

            {isSupabaseConnected && mode === 'password' && (
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    required
                    minLength={6}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 font-bold"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-xl text-white font-black text-xs shadow-sm flex items-center justify-center gap-1.5 hover:opacity-95 disabled:opacity-50"
              style={{ backgroundColor: tenant.primaryColor }}
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {!isSupabaseConnected
                  ? 'Entrar em Modo Local (Demo)'
                  : mode === 'magic'
                  ? 'Enviar Magic Link por E-mail'
                  : isSignUp
                  ? 'Criar Conta'
                  : 'Entrar na Plataforma'}
              </span>
            </button>
          </form>

          {isSupabaseConnected && mode === 'password' && (
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setFeedback(null);
              }}
              className="w-full text-center font-bold text-slate-600 hover:text-slate-900 py-1"
            >
              {isSignUp ? 'Já tem conta? Fazer login' : 'Não tem conta? Criar gratuitamente'}
            </button>
          )}

          {isSupabaseConnected && (
            <>
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200" />
                <span className="flex-shrink mx-3 text-[10px] font-bold uppercase text-slate-400">ou</span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Continuar com Google</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
