import React, { useState, useEffect } from 'react';
import {
  Bell, X, Smartphone, MessageCircle, Mail, Sparkles, CheckCircle2,
  Sliders, Target, Download, Send, LogIn, Cloud, ShieldCheck, Route,
} from 'lucide-react';
import { useTenant } from '../config/tenant';
import { useAuth } from '../config/auth';
import type { Property } from '../types/auction';
import { formatCurrencyBRL } from '../utils/financial';
import {
  type UserRadarProfile,
  type RadarMatchResult,
} from '../utils/radarMatchEngine';
import {
  isPwaStandalone,
  isIosDevice,
  getNotificationPermission,
  requestAndSubscribeWebPush,
  sendTestLocalNotification,
} from '../utils/pwaManager';
import { getTenantIconUrl } from '../utils/brandingIcons';

interface RadarIAModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserRadarProfile;
  onChangeProfile: (next: UserRadarProfile) => void;
  onSaveProfile: () => Promise<{ savedToSupabase: boolean; error?: string }>;
  matches: RadarMatchResult[];
  canInstallPwa: boolean;
  onInstallPwa: () => void;
  onOpenAuth: () => void;
  onSelectProperty: (p: Property) => void;
  onOpenJourney: (p: Property) => void;
}

const UFS = ['SP', 'RJ', 'MG', 'PR', 'RS', 'SC', 'BA', 'GO', 'DF', 'PE', 'CE'];
const BANKS = [
  { id: 'CAIXA', label: 'Caixa' },
  { id: 'BRADESCO', label: 'Bradesco' },
  { id: 'SANTANDER', label: 'Santander' },
  { id: 'ITAU', label: 'Itaú' },
  { id: 'BB', label: 'Banco do Brasil' },
  { id: 'JUDICIAL', label: 'Judicial' },
  { id: 'ZUK', label: 'Portal Zuk' },
  { id: 'MEGA', label: 'Mega Leilões' },
];
const TYPES = ['Apartamento', 'Casa', 'Comercial', 'Terreno'];

export const RadarIAModal: React.FC<RadarIAModalProps> = ({
  isOpen,
  onClose,
  profile,
  onChangeProfile,
  onSaveProfile,
  matches,
  canInstallPwa,
  onInstallPwa,
  onOpenAuth,
  onSelectProperty,
  onOpenJourney,
}) => {
  const { tenant } = useTenant();
  const { user, isSupabaseConnected } = useAuth();

  const [activeTab, setActiveTab] = useState<'criteria' | 'channels' | 'matches'>('criteria');
  const [pushStatus, setPushStatus] = useState<string>('');
  const [saveFeedback, setSaveFeedback] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    getNotificationPermission()
  );

  useEffect(() => {
    if (isOpen) {
      setNotifPerm(getNotificationPermission());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleInArray = (arr: string[], value: string): string[] =>
    arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];

  const handleActivatePush = async () => {
    const res = await requestAndSubscribeWebPush(
      user && !user.isDemoSession ? user.id : undefined,
      tenant.id
    );
    setNotifPerm(getNotificationPermission());
    setPushStatus(res.message);
    if (res.granted) {
      onChangeProfile({ ...profile, notifyPwaPush: true });
    }
  };

  const handleTestNotification = async () => {
    const top = matches[0];
    const title = top
      ? `${tenant.brandName} • Match ${top.matchScore}/100`
      : `${tenant.brandName} • Radar IA Ativo`;
    const body = top
      ? `${top.property.title} — ${formatCurrencyBRL(top.property.secondAuctionPrice)} (${top.property.apparentDiscountPercentage}% desc.)`
      : 'Você receberá alertas no celular assim que novos imóveis coincidirem com seu perfil.';

    const sent = await sendTestLocalNotification(title, body, getTenantIconUrl(tenant));
    setNotifPerm(getNotificationPermission());
    setPushStatus(
      sent
        ? 'Notificação de teste disparada! Verifique a barra de notificações.'
        : 'Permita as notificações no navegador para testar o aviso.'
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveFeedback('');
    try {
      const res = await onSaveProfile();
      if (res.savedToSupabase) {
        setSaveFeedback('Critérios salvos e sincronizados no Supabase!');
      } else if (res.error) {
        setSaveFeedback(`Salvo localmente (nuvem pendente: ${res.error})`);
      } else {
        setSaveFeedback(
          user && !user.isDemoSession
            ? 'Critérios salvos localmente!'
            : 'Critérios salvos neste aparelho. Faça login quando o Supabase estiver ativo para sincronizar.'
        );
      }
      setTimeout(() => setSaveFeedback(''), 4000);
    } finally {
      setSaving(false);
    }
  };

  const standalone = isPwaStandalone();
  const isIos = isIosDevice();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                Monitoramento Automático & PWA Push
              </span>
              <h2 className="text-base font-black text-white">Radar IA de Oportunidades</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-navegação */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('criteria')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'criteria' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Critérios & Tolerância</span>
            </button>
            <button
              onClick={() => setActiveTab('channels')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'channels' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>PWA & Canais</span>
            </button>
            <button
              onClick={() => setActiveTab('matches')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'matches' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <Target className="w-3.5 h-3.5 text-emerald-500" />
              <span>Matches ({matches.length})</span>
            </button>
          </div>

          {/* Status da Conta */}
          {user ? (
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1">
              <Cloud className="w-3 h-3" />
              {user.isDemoSession ? `Local: ${user.name}` : `Nuvem: ${user.email}`}
            </span>
          ) : (
            <button
              onClick={onOpenAuth}
              className="text-[11px] font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 px-2.5 py-1 rounded-full flex items-center gap-1"
            >
              <LogIn className="w-3 h-3" />
              <span>Entrar p/ Sincronizar</span>
            </button>
          )}
        </div>

        {/* Conteúdo */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
          {activeTab === 'criteria' && (
            <>
              {/* Estados */}
              <div className="space-y-2">
                <label className="font-black text-slate-700 uppercase text-[10px] block">
                  Estados de Interesse (UFs)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {UFS.map((uf) => {
                    const active = profile.states.includes(uf);
                    return (
                      <button
                        key={uf}
                        type="button"
                        onClick={() =>
                          onChangeProfile({ ...profile, states: toggleInArray(profile.states, uf) })
                        }
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                          active ? 'text-white shadow-2xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                        style={active ? { backgroundColor: tenant.primaryColor } : undefined}
                      >
                        {uf}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cidade, Preço Máx, Desconto */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Cidade (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: Campinas, Santos..."
                    value={profile.cityQuery}
                    onChange={(e) => onChangeProfile({ ...profile, cityQuery: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Preço Máximo (R$)</label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={profile.maxPrice}
                    onChange={(e) =>
                      onChangeProfile({ ...profile, maxPrice: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-black"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">
                    Desconto Mínimo: <strong>{profile.minDiscountPct}%</strong>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={70}
                    step={5}
                    value={profile.minDiscountPct}
                    onChange={(e) =>
                      onChangeProfile({ ...profile, minDiscountPct: Number(e.target.value) })
                    }
                    className="w-full accent-slate-900 mt-2"
                  />
                </div>
              </div>

              {/* Bancos e Tipos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="font-bold text-slate-700 block">
                    Bancos (vazio = todos)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {BANKS.map((b) => {
                      const active = profile.banks.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() =>
                            onChangeProfile({ ...profile, banks: toggleInArray(profile.banks, b.id) })
                          }
                          className={`px-3 py-1.5 rounded-xl font-bold border transition-all ${
                            active
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {b.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-bold text-slate-700 block">
                    Tipos de Imóvel (vazio = todos)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {TYPES.map((t) => {
                      const active = profile.propertyTypes.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() =>
                            onChangeProfile({
                              ...profile,
                              propertyTypes: toggleInArray(profile.propertyTypes, t),
                            })
                          }
                          className={`px-3 py-1.5 rounded-xl font-bold border transition-all ${
                            active
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Opções de Risco & Tolerância da IA */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                <h3 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" /> Inteligência de Proximidade ("Quase Match")
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Tolerância acima do preço máximo: <strong>+{profile.priceTolerancePct}%</strong>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={25}
                      step={5}
                      value={profile.priceTolerancePct}
                      onChange={(e) =>
                        onChangeProfile({ ...profile, priceTolerancePct: Number(e.target.value) })
                      }
                      className="w-full accent-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Tolerância abaixo do desconto alvo: <strong>-{profile.discountTolerancePp} p.p.</strong>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={15}
                      step={1}
                      value={profile.discountTolerancePp}
                      onChange={(e) =>
                        onChangeProfile({ ...profile, discountTolerancePp: Number(e.target.value) })
                      }
                      className="w-full accent-emerald-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between cursor-pointer">
                    <span className="font-bold text-slate-800">Exigir que aceite financiamento</span>
                    <input
                      type="checkbox"
                      checked={profile.requireFinancing}
                      onChange={(e) =>
                        onChangeProfile({ ...profile, requireFinancing: e.target.checked })
                      }
                      className="w-4 h-4 accent-slate-900"
                    />
                  </label>

                  <label className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between cursor-pointer">
                    <span className="font-bold text-slate-800">Aceitar imóveis ocupados</span>
                    <input
                      type="checkbox"
                      checked={profile.acceptOccupied}
                      onChange={(e) =>
                        onChangeProfile({ ...profile, acceptOccupied: e.target.checked })
                      }
                      className="w-4 h-4 accent-slate-900"
                    />
                  </label>
                </div>
              </div>
            </>
          )}

          {activeTab === 'channels' && (
            <div className="space-y-4">
              {/* Card Instalação PWA no Celular */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 block">
                      App Instalável (Custo Zero)
                    </span>
                    <h3 className="font-black text-sm">Instalar no Celular / Desktop (PWA)</h3>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Receba notificações direto na tela bloqueada sem precisar publicar na App Store/Play Store.
                    </p>
                  </div>

                  {standalone ? (
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> App Instalado
                    </span>
                  ) : canInstallPwa ? (
                    <button
                      onClick={onInstallPwa}
                      className="bg-sky-500 hover:bg-sky-600 text-white font-black px-4 py-2 rounded-xl flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      <span>Instalar App Agora</span>
                    </button>
                  ) : isIos ? (
                    <span className="text-[11px] bg-white/10 px-3 py-1.5 rounded-xl text-slate-200">
                      No iPhone/Safari: toque em <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong>
                    </span>
                  ) : (
                    <span className="text-[11px] bg-white/10 px-3 py-1.5 rounded-xl text-slate-200">
                      Use o menu do navegador → <strong>Instalar aplicativo</strong>
                    </span>
                  )}
                </div>

                {/* Ativar Web Push & Testar */}
                <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-300">
                    Permissão de Notificação:{' '}
                    <strong className="text-white uppercase">
                      {notifPerm === 'granted'
                        ? 'Ativada'
                        : notifPerm === 'denied'
                        ? 'Bloqueada'
                        : notifPerm === 'unsupported'
                        ? 'Não suportada'
                        : 'Aguardando'}
                    </strong>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleActivatePush}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Ativar Push no Celular</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleTestNotification}
                      className="bg-white/10 hover:bg-white/20 text-white font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Testar Notificação</span>
                    </button>
                  </div>
                </div>

                {pushStatus && (
                  <p className="text-[11px] bg-white/10 text-emerald-300 px-3 py-2 rounded-xl font-medium">
                    {pushStatus}
                  </p>
                )}
              </div>

              {/* Canais Complementares */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl border border-sky-200 bg-sky-50/50 space-y-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <MessageCircle className="w-4 h-4 text-sky-600" /> Bot Telegram (Grátis)
                    </span>
                    <input
                      type="checkbox"
                      checked={profile.notifyTelegram}
                      onChange={(e) =>
                        onChangeProfile({ ...profile, notifyTelegram: e.target.checked })
                      }
                      className="w-4 h-4 accent-sky-600"
                    />
                  </label>
                  {profile.notifyTelegram && (
                    <input
                      type="text"
                      placeholder="Seu Chat ID do Telegram (opcional)"
                      value={profile.telegramChatId}
                      onChange={(e) =>
                        onChangeProfile({ ...profile, telegramChatId: e.target.value })
                      }
                      className="w-full bg-white border border-sky-200 rounded-xl px-3 py-2 text-[11px] font-medium"
                    />
                  )}
                </div>

                <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-slate-700" /> Resumo por E-mail
                    </span>
                    <input
                      type="checkbox"
                      checked={profile.notifyEmail}
                      onChange={(e) =>
                        onChangeProfile({ ...profile, notifyEmail: e.target.checked })
                      }
                      className="w-4 h-4 accent-slate-900"
                    />
                  </label>
                  <select
                    value={profile.frequency}
                    onChange={(e) =>
                      onChangeProfile({
                        ...profile,
                        frequency: e.target.value as UserRadarProfile['frequency'],
                      })
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold"
                  >
                    <option value="IMMEDIATE">Disparo Imediato (Matches 85+)</option>
                    <option value="DAILY">Resumo Diário (08h00)</option>
                    <option value="WEEKLY">Resumo Semanal</option>
                  </select>
                </div>

                <div className="sm:col-span-2 p-3.5 rounded-2xl border border-amber-200 bg-amber-50/50 space-y-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-600" /> WhatsApp Oficial (Recurso Pro / B2B)
                    </span>
                    <input
                      type="checkbox"
                      checked={profile.notifyWhatsappPro}
                      onChange={(e) =>
                        onChangeProfile({ ...profile, notifyWhatsappPro: e.target.checked })
                      }
                      className="w-4 h-4 accent-amber-600"
                    />
                  </label>
                  {profile.notifyWhatsappPro && (
                    <input
                      type="text"
                      placeholder="WhatsApp com DDD: Ex: +55 11 99999-9999"
                      value={profile.whatsappPhone}
                      onChange={(e) =>
                        onChangeProfile({ ...profile, whatsappPhone: e.target.value })
                      }
                      className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-[11px] font-medium"
                    />
                  )}
                </div>
              </div>

              {!isSupabaseConnected && (
                <p className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  Nota: quando as credenciais do Supabase estiverem ativas no <code>.env</code>, seus critérios e assinatura Push ficarão sincronizados automaticamente na sua conta.
                </p>
              )}
            </div>
          )}

          {activeTab === 'matches' && (
            <div className="space-y-3">
              {matches.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center space-y-2">
                  <Target className="w-10 h-10 text-slate-300 mx-auto" />
                  <h4 className="font-black text-slate-800">Nenhum match na base carregada</h4>
                  <p className="text-slate-500">
                    Ajuste o teto de preço, estados ou aumente a tolerância na aba Critérios.
                  </p>
                </div>
              ) : (
                matches.map((m) => (
                  <div
                    key={m.property.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-2.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              m.matchType === 'EXACT'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {m.matchType === 'EXACT' ? 'Match Exato' : 'Próximo do Perfil'} · {m.matchScore}/100
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">
                            {m.property.bankName} • {m.property.address.city}/{m.property.address.state}
                          </span>
                        </div>
                        <h4 className="font-black text-slate-900 text-sm truncate">{m.property.title}</h4>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-black text-emerald-700 block">
                          {formatCurrencyBRL(m.property.secondAuctionPrice)}
                        </span>
                        <span className="text-[10px] font-bold text-red-600">
                          -{m.property.apparentDiscountPercentage}% desc.
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {m.aiBrief}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap gap-1">
                        {m.reasons.slice(0, 3).map((r) => (
                          <span
                            key={r}
                            className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md"
                          >
                            {r}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            onClose();
                            onSelectProperty(m.property);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-[11px]"
                        >
                          Ficha 360°
                        </button>
                        <button
                          onClick={() => {
                            onClose();
                            onOpenJourney(m.property);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1"
                        >
                          <Route className="w-3 h-3" />
                          <span>Jornada</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] font-bold text-emerald-700">
            {saveFeedback || `${matches.length} oportunidades compatíveis encontradas agora.`}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-white font-black text-xs shadow-sm hover:opacity-95 disabled:opacity-50"
            style={{ backgroundColor: tenant.primaryColor }}
          >
            {saving ? 'Salvando...' : 'Salvar Critérios do Radar'}
          </button>
        </div>
      </div>
    </div>
  );
};
