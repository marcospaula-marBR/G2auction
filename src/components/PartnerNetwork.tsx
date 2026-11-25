import React, { useState, useMemo, useEffect } from 'react';
import type { Partner, PartnerService } from '../types/auction';
import {
  ShieldCheck, Star, Phone, MapPin, UserCheck, Search,
  CreditCard, CheckCircle2, Lock, ArrowRight, X, Clock,
  Briefcase, Percent, Split, Building2, Edit3, Trash2, Ban,
} from 'lucide-react';
import { useTenant } from '../config/tenant';
import { useAuth } from '../config/auth';
import { supabase } from '../lib/supabaseClient';
import { formatCurrencyBRL } from '../utils/financial';
import {
  fetchPartnersFromSupabase,
  createPartnerInSupabase,
  updatePartnerInSupabase,
  deletePartnerInSupabase,
  dbPartnerToUiPartner,
  mapPartnerRoleToCategory,
  type PartnerApprovalDb,
} from '../utils/adminStakeholdersService';

interface PartnerNetworkProps {
  partners: Partner[];
}

interface ServiceOrderRecord {
  id: string;
  partnerName: string;
  partnerRole: string;
  serviceTitle: string;
  grossAmount: number;
  platformFeeAmount: number;
  tenantFeeAmount: number;
  partnerNetAmount: number;
  provider: 'Asaas Split' | 'Pagar.me Split' | 'Stripe Connect';
  status: 'ESCROW_RETIDO' | 'PAGO_SPLIT';
  createdAt: string;
}

const ROLE_FILTERS = [
  { id: 'ALL', label: 'Todos' },
  { id: 'CORRETOR', label: 'Corretores' },
  { id: 'ADVOGADO', label: 'Advogados' },
  { id: 'ADMIN', label: 'Administradores & Despachantes' },
  { id: 'REFORMA', label: 'Pedreiros & Reforma' },
  { id: 'ENGENHARIA', label: 'Engenharia & Avaliação' },
];

function matchesRoleFilter(role: Partner['role'], filterId: string): boolean {
  if (filterId === 'ALL') return true;
  const r = role.toLowerCase();
  if (filterId === 'CORRETOR') return r.includes('corretor');
  if (filterId === 'ADVOGADO') return r.includes('advogado');
  if (filterId === 'ADMIN') return r.includes('administrador') || r.includes('despachante');
  if (filterId === 'REFORMA') return r.includes('pedreiro') || r.includes('obra') || r.includes('reforma');
  if (filterId === 'ENGENHARIA') return r.includes('engenheiro') || r.includes('arquiteto') || r.includes('avaliador');
  return true;
}

const DEMO_PARTNERS_OVERRIDES_KEY = 'auction_demo_partners_overrides_v1';

interface DemoPartnerOverrides {
  hiddenIds: string[];
  edited: Record<string, Partner>;
}

function readDemoOverrides(): DemoPartnerOverrides {
  try {
    const raw = localStorage.getItem(DEMO_PARTNERS_OVERRIDES_KEY);
    if (!raw) return { hiddenIds: [], edited: {} };
    const parsed = JSON.parse(raw);
    return {
      hiddenIds: Array.isArray(parsed?.hiddenIds) ? parsed.hiddenIds : [],
      edited: parsed?.edited && typeof parsed.edited === 'object' ? parsed.edited : {},
    };
  } catch {
    return { hiddenIds: [], edited: {} };
  }
}

function saveDemoOverrides(next: DemoPartnerOverrides) {
  try {
    localStorage.setItem(DEMO_PARTNERS_OVERRIDES_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

export const PartnerNetwork: React.FC<PartnerNetworkProps> = ({ partners: initialPartners }) => {
  const { tenant } = useTenant();
  const { user, switchAccountRole } = useAuth();
  const isAdmin = Boolean(user?.isManager || tenant.features.adminSync);

  const [partners, setPartners] = useState<Partner[]>(() => {
    const ov = readDemoOverrides();
    return initialPartners
      .filter((p) => !ov.hiddenIds.includes(p.id))
      .map((p) => ({ ...(ov.edited[p.id] || p), source: 'demo' as const }));
  });
  const [subTab, setSubTab] = useState<'marketplace' | 'onboarding'>(() =>
    user?.accountRole === 'partner' ? 'onboarding' : 'marketplace'
  );
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [adminFeedback, setAdminFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    role: 'Corretor de Imóveis' as Partner['role'],
    registrationCode: '',
    city: '',
    state: 'SP',
    phone: '',
    email: '',
    pixKey: '',
    specialty: '',
    startingPrice: '500',
    dbStatus: 'APPROVED' as PartnerApprovalDb,
  });
  const [savingPartner, setSavingPartner] = useState<boolean>(false);

  // Modal Checkout Split Payment
  const [checkoutPartner, setCheckoutPartner] = useState<Partner | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [splitProvider, setSplitProvider] = useState<'Asaas Split' | 'Pagar.me Split' | 'Stripe Connect'>('Asaas Split');
  const [orders, setOrders] = useState<ServiceOrderRecord[]>([]);

  // Form Onboarding Novo Parceiro
  const [newPartnerForm, setNewPartnerForm] = useState({
    name: '',
    role: 'Corretor de Imóveis' as Partner['role'],
    registrationCode: '',
    city: '',
    state: 'SP',
    phone: '',
    pixKey: '',
    specialty: '',
    serviceTitle: '',
    startingPrice: '500',
  });
  const [onboardingSuccess, setOnboardingSuccess] = useState(false);

  useEffect(() => {
    if (user?.accountRole === 'partner') {
      setSubTab('onboarding');
      setNewPartnerForm((prev) => ({
        ...prev,
        name: prev.name || user.name || '',
      }));
    }
  }, [user?.id, user?.accountRole, user?.name]);

  useEffect(() => {
    let active = true;
    fetchPartnersFromSupabase().then((res) => {
      if (!active || !res.ok) return;
      const dbPartners = res.partners.map(dbPartnerToUiPartner);
      const ov = readDemoOverrides();
      const demoPartners = initialPartners
        .filter((p) => !ov.hiddenIds.includes(p.id))
        .map((p) => ({ ...(ov.edited[p.id] || p), source: 'demo' as const }));
      setPartners([...dbPartners, ...demoPartners]);
    });
    return () => {
      active = false;
    };
  }, [initialPartners, user?.id, user?.isManager]);

  const openEditPartner = (partner: Partner) => {
    setEditingPartner(partner);
    setEditForm({
      name: partner.name,
      role: partner.role,
      registrationCode: partner.registrationCode || '',
      city: partner.city,
      state: partner.state,
      phone: partner.phone || '',
      email: partner.email || '',
      pixKey: partner.pixKey || '',
      specialty: partner.specialty || '',
      startingPrice: String(partner.startingPrice || 500),
      dbStatus:
        partner.dbStatus ||
        (partner.approvalStatus === 'HOMOLOGADO'
          ? 'APPROVED'
          : partner.approvalStatus === 'SUSPENSO'
          ? 'SUSPENDED'
          : 'PENDING'),
    });
  };

  const handleSavePartnerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner || !editForm.name.trim() || !editForm.city.trim()) return;
    setSavingPartner(true);
    setAdminFeedback(null);
    try {
      const uiStatus: Partner['approvalStatus'] =
        editForm.dbStatus === 'APPROVED'
          ? 'HOMOLOGADO'
          : editForm.dbStatus === 'SUSPENDED'
          ? 'SUSPENSO'
          : 'EM_HOMOLOGACAO';

      const updated: Partner = {
        ...editingPartner,
        name: editForm.name.trim(),
        role: editForm.role,
        registrationCode: editForm.registrationCode.trim() || undefined,
        city: editForm.city.trim(),
        state: editForm.state.trim().toUpperCase().slice(0, 2) || 'SP',
        phone: editForm.phone.trim() || '(Não informado)',
        email: editForm.email.trim() || undefined,
        pixKey: editForm.pixKey.trim() || undefined,
        specialty: editForm.specialty.trim() || editingPartner.specialty,
        startingPrice: Math.max(50, Number(editForm.startingPrice) || 500),
        verified: editForm.dbStatus === 'APPROVED',
        splitReady: Boolean(editForm.pixKey.trim()),
        approvalStatus: uiStatus,
        dbStatus: editForm.dbStatus,
      };

      if (editingPartner.source === 'supabase' && supabase) {
        const res = await updatePartnerInSupabase(editingPartner.id, {
          name: updated.name,
          category: mapPartnerRoleToCategory(updated.role),
          registration_code: updated.registrationCode || null,
          city: updated.city,
          state: updated.state,
          phone: updated.phone,
          email: updated.email || null,
          pix_key: updated.pixKey || null,
          specialty: updated.specialty,
          approval_status: editForm.dbStatus,
        });
        if (!res.ok) {
          setAdminFeedback({ type: 'error', text: res.error || 'Erro ao atualizar parceiro no banco.' });
          return;
        }
      } else {
        const ov = readDemoOverrides();
        ov.edited[editingPartner.id] = updated;
        saveDemoOverrides(ov);
      }

      setPartners((prev) => prev.map((p) => (p.id === editingPartner.id ? updated : p)));
      setAdminFeedback({ type: 'success', text: `Parceiro "${updated.name}" atualizado!` });
      setEditingPartner(null);
    } finally {
      setSavingPartner(false);
    }
  };

  const handleTogglePartnerStatus = async (partner: Partner, nextDbStatus: PartnerApprovalDb) => {
    setAdminFeedback(null);
    const uiStatus: Partner['approvalStatus'] =
      nextDbStatus === 'APPROVED'
        ? 'HOMOLOGADO'
        : nextDbStatus === 'SUSPENDED'
        ? 'SUSPENSO'
        : 'EM_HOMOLOGACAO';

    if (partner.source === 'supabase' && supabase) {
      const res = await updatePartnerInSupabase(partner.id, { approval_status: nextDbStatus });
      if (!res.ok) {
        setAdminFeedback({ type: 'error', text: res.error || 'Erro ao alterar status.' });
        return;
      }
    } else {
      const ov = readDemoOverrides();
      ov.edited[partner.id] = {
        ...partner,
        verified: nextDbStatus === 'APPROVED',
        approvalStatus: uiStatus,
        dbStatus: nextDbStatus,
      };
      saveDemoOverrides(ov);
    }

    setPartners((prev) =>
      prev.map((p) =>
        p.id === partner.id
          ? { ...p, verified: nextDbStatus === 'APPROVED', approvalStatus: uiStatus, dbStatus: nextDbStatus }
          : p
      )
    );
    setAdminFeedback({
      type: 'success',
      text: `Status de "${partner.name}" alterado para ${nextDbStatus === 'APPROVED' ? 'Homologado' : 'Suspenso'}.`,
    });
  };

  const handleDeletePartner = async (partner: Partner) => {
    const confirmed = window.confirm(`Excluir o parceiro "${partner.name}"?`);
    if (!confirmed) return;
    setAdminFeedback(null);

    if (partner.source === 'supabase' && supabase) {
      const res = await deletePartnerInSupabase(partner.id);
      if (!res.ok) {
        setAdminFeedback({ type: 'error', text: res.error || 'Erro ao excluir parceiro no Supabase.' });
        return;
      }
    } else {
      const ov = readDemoOverrides();
      if (!ov.hiddenIds.includes(partner.id)) {
        ov.hiddenIds.push(partner.id);
      }
      delete ov.edited[partner.id];
      saveDemoOverrides(ov);
    }

    setPartners((prev) => prev.filter((p) => p.id !== partner.id));
    setAdminFeedback({ type: 'success', text: `Parceiro "${partner.name}" removido.` });
  };

  const filteredPartners = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return partners.filter((p) => {
      const okRole = matchesRoleFilter(p.role, roleFilter);
      if (!okRole) return false;
      if (!q) return true;
      const text = `${p.name} ${p.role} ${p.city} ${p.state} ${p.specialty}`.toLowerCase();
      return text.includes(q);
    });
  }, [partners, roleFilter, searchTerm]);

  const openCheckout = (partner: Partner) => {
    setCheckoutPartner(partner);
    const firstSrv = partner.services?.[0];
    setSelectedServiceId(firstSrv ? firstSrv.id : 'custom');
    setCustomAmount(firstSrv ? String(firstSrv.price) : String(partner.startingPrice || 500));
  };

  const activeService: PartnerService | undefined = useMemo(() => {
    if (!checkoutPartner || !checkoutPartner.services) return undefined;
    return checkoutPartner.services.find((s) => s.id === selectedServiceId);
  }, [checkoutPartner, selectedServiceId]);

  const grossAmount = useMemo(() => {
    if (selectedServiceId !== 'custom' && activeService) {
      return activeService.price;
    }
    return Math.max(0, Number(customAmount) || 0);
  }, [selectedServiceId, activeService, customAmount]);

  const splitBreakdown = useMemo(() => {
    const platformPct = tenant.platformFeePct ?? 10;
    const tenantPct = tenant.tenantFeePct ?? 0;
    const platformFee = Math.round(grossAmount * (platformPct / 100) * 100) / 100;
    const tenantFee = Math.round(grossAmount * (tenantPct / 100) * 100) / 100;
    const partnerNet = Math.max(0, Math.round((grossAmount - platformFee - tenantFee) * 100) / 100);
    return { platformPct, tenantPct, platformFee, tenantFee, partnerNet };
  }, [grossAmount, tenant.platformFeePct, tenant.tenantFeePct]);

  const handleConfirmOrder = () => {
    if (!checkoutPartner || grossAmount <= 0) return;

    const newOrder: ServiceOrderRecord = {
      id: `ORD-${Date.now().toString().slice(-6)}`,
      partnerName: checkoutPartner.name,
      partnerRole: checkoutPartner.role,
      serviceTitle: activeService ? activeService.title : 'Orçamento / Serviço Personalizado',
      grossAmount,
      platformFeeAmount: splitBreakdown.platformFee,
      tenantFeeAmount: splitBreakdown.tenantFee,
      partnerNetAmount: splitBreakdown.partnerNet,
      provider: splitProvider,
      status: 'ESCROW_RETIDO',
      createdAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setOrders((prev) => [newOrder, ...prev]);
    setCheckoutPartner(null);
  };

  const handleSubmitOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerForm.name.trim() || !newPartnerForm.city.trim()) return;

    const priceNum = Math.max(100, Number(newPartnerForm.startingPrice) || 500);
    const created: Partner = {
      id: `part-${Date.now()}`,
      name: newPartnerForm.name.trim(),
      role: newPartnerForm.role,
      city: newPartnerForm.city.trim(),
      state: newPartnerForm.state.toUpperCase(),
      rating: 5.0,
      completedJobsCount: 0,
      onTimeRate: 100,
      trustScore: 85,
      phone: newPartnerForm.phone || '(11) 99999-0000',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      specialty: newPartnerForm.specialty || `Especialista credenciado em ${newPartnerForm.role}.`,
      verified: false,
      registrationCode: newPartnerForm.registrationCode || 'Em validação',
      startingPrice: priceNum,
      responseTimeHours: 4,
      splitReady: Boolean(newPartnerForm.pixKey.trim()),
      approvalStatus: 'EM_HOMOLOGACAO',
      services: [
        {
          id: `srv-${Date.now()}`,
          title: newPartnerForm.serviceTitle || 'Consultoria / Serviço Inicial',
          description: newPartnerForm.specialty || 'Atendimento especializado para arrematação e pós-leilão.',
          price: priceNum,
          billingModel: 'Fixo',
          turnaroundDays: 3,
        },
      ],
    };

    if (supabase && user && !user.isDemoSession) {
      const res = await createPartnerInSupabase({
        tenantId: tenant.id,
        userId: user.id,
        name: created.name,
        category: mapPartnerRoleToCategory(newPartnerForm.role),
        registrationCode: newPartnerForm.registrationCode,
        city: created.city,
        state: created.state,
        phone: newPartnerForm.phone,
        email: user.email,
        specialty: created.specialty,
        pixKey: newPartnerForm.pixKey,
        approvalStatus: isAdmin ? 'APPROVED' : 'PENDING',
      });
      if (res.ok && res.partner) {
        created.id = res.partner.id;
        created.source = 'supabase';
        created.dbStatus = res.partner.approval_status;
        created.approvalStatus = res.partner.approval_status === 'APPROVED' ? 'HOMOLOGADO' : 'EM_HOMOLOGACAO';
        created.verified = res.partner.approval_status === 'APPROVED';
      }
    }

    setPartners((prev) => [created, ...prev]);
    setOnboardingSuccess(true);
    setNewPartnerForm({
      name: '',
      role: 'Corretor de Imóveis',
      registrationCode: '',
      city: '',
      state: 'SP',
      phone: '',
      pixKey: '',
      specialty: '',
      serviceTitle: '',
      startingPrice: '500',
    });
    setTimeout(() => {
      setOnboardingSuccess(false);
      setSubTab('marketplace');
    }, 1800);
  };

  return (
    <div className="space-y-6">
      {/* Faixa Portal do Parceiro Autenticado */}
      {user?.accountRole === 'partner' && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-indigo-950">
            <Briefcase className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              <strong>Portal do Parceiro Autenticado:</strong> {user.name} ({user.email}) — preencha seu credenciamento abaixo para entrar no catálogo e receber via Split.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              switchAccountRole('investor');
              setSubTab('marketplace');
            }}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-100 border border-indigo-200 text-indigo-800 font-bold text-[11px] transition-colors"
          >
            Alternar para Visão Investidor
          </button>
        </div>
      )}

      {/* Faixa Modo Admin (Edição/Homologação/Exclusão de Parceiros) */}
      {isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Modo Administrador:</strong> você pode editar dados, homologar, suspender ou excluir parceiros diretamente nos cards abaixo.
            </span>
          </div>
          {adminFeedback && (
            <span
              className={`font-bold px-2.5 py-0.5 rounded-lg ${
                adminFeedback.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {adminFeedback.text}
            </span>
          )}
        </div>
      )}

      {/* Header do Marketplace de Parceiros */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Ecossistema Homologado • {tenant.brandName}
            </span>
            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 flex items-center gap-1">
              <Split className="w-3 h-3 text-blue-600" /> Pagamento em Escrow + Split ({tenant.platformFeePct}% fee plataforma)
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900">
            Área do Parceiro & Serviços Especializados
          </h2>
          <p className="text-xs text-slate-500">
            Contrate corretores, advogados, administradores, despachantes, engenheiros e pedreiros com pagamento protegido e repasse automático.
          </p>
        </div>

        {/* Seletor de Sub-aba */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start lg:self-auto">
          <button
            onClick={() => setSubTab('marketplace')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              subTab === 'marketplace' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Contratar Especialistas</span>
          </button>
          <button
            onClick={() => setSubTab('onboarding')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              subTab === 'onboarding' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Seja um Parceiro</span>
          </button>
        </div>
      </div>

      {/* Contratações Recentes (Split Ledger Strip) */}
      {orders.length > 0 && (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Ordens de Serviço com Split Configurado ({orders.length})
            </h3>
            <span className="text-[11px] font-bold text-emerald-800">
              Valor retido em Escrow até entrega do serviço
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {orders.map((ord) => (
              <div key={ord.id} className="bg-white p-3 rounded-xl border border-emerald-200/80 text-xs flex flex-col gap-1">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>{ord.partnerName} · <span className="text-slate-500 font-medium">{ord.serviceTitle}</span></span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">{ord.id}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                  <span>Bruto: <strong>{formatCurrencyBRL(ord.grossAmount)}</strong></span>
                  <span>Fee Plataforma: <strong className="text-blue-700">{formatCurrencyBRL(ord.platformFeeAmount)}</strong></span>
                  {ord.tenantFeeAmount > 0 && (
                    <span>Fee Licenciado: <strong className="text-purple-700">{formatCurrencyBRL(ord.tenantFeeAmount)}</strong></span>
                  )}
                  <span>Líquido Parceiro: <strong className="text-emerald-700">{formatCurrencyBRL(ord.partnerNetAmount)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'marketplace' ? (
        <>
          {/* Barra de Busca e Filtro por Especialidade */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome, cidade, OAB, reforma..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs font-medium text-slate-800"
                />
              </div>

              <span className="text-xs font-bold text-slate-500">
                {filteredPartners.length} profissionais disponíveis
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {ROLE_FILTERS.map((rf) => {
                const active = roleFilter === rf.id;
                return (
                  <button
                    key={rf.id}
                    onClick={() => setRoleFilter(rf.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      active ? 'text-white shadow-2xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                    style={active ? { backgroundColor: tenant.primaryColor } : undefined}
                  >
                    {rf.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid de Parceiros */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredPartners.map((partner) => (
              <div
                key={partner.id}
                className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start space-x-3.5">
                    <img
                      src={partner.avatar}
                      alt={partner.name}
                      className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-black text-slate-900 text-sm sm:text-base truncate">{partner.name}</h3>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200 shrink-0">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" /> {partner.trustScore}/100
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <p className="text-xs font-bold" style={{ color: tenant.primaryColor }}>
                          {partner.role}
                        </p>
                        {partner.registrationCode && (
                          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {partner.registrationCode}
                          </span>
                        )}
                        {partner.approvalStatus === 'EM_HOMOLOGACAO' && (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                            Em Homologação
                          </span>
                        )}
                        {partner.approvalStatus === 'SUSPENSO' && (
                          <span className="text-[10px] font-bold bg-red-100 text-red-800 px-1.5 py-0.5 rounded">
                            Suspenso
                          </span>
                        )}
                        {partner.source === 'supabase' && (
                          <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded">
                            Supabase
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center text-[11px] text-slate-500 gap-3 mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {partner.city} - {partner.state}
                        </span>
                        {partner.responseTimeHours && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            Responde em ~{partner.responseTimeHours}h
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100 font-medium leading-relaxed">
                    {partner.specialty}
                  </p>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Avaliação</span>
                      <span className="font-extrabold text-slate-800 flex items-center justify-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> {partner.rating.toFixed(1)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Entregas</span>
                      <span className="font-extrabold text-slate-800">{partner.completedJobsCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">A partir de</span>
                      <span className="font-extrabold text-emerald-700">
                        {partner.startingPrice ? formatCurrencyBRL(partner.startingPrice) : 'Sob consulta'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ação & Split Info */}
                <div className="space-y-2.5 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[11px] text-slate-600 font-semibold">
                      <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{partner.phone}</span>
                    </div>

                    <button
                      onClick={() => openCheckout(partner)}
                      className="text-white text-xs font-bold px-4 py-2 rounded-xl shadow-2xs flex items-center gap-1.5 transition-opacity hover:opacity-95"
                      style={{ backgroundColor: tenant.primaryColor }}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Contratar / Orçar</span>
                    </button>
                  </div>

                  {isAdmin && (
                    <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-slate-100 text-[11px]">
                      {partner.approvalStatus !== 'HOMOLOGADO' ? (
                        <button
                          type="button"
                          onClick={() => handleTogglePartnerStatus(partner, 'APPROVED')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Homologar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleTogglePartnerStatus(partner, 'SUSPENDED')}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold flex items-center gap-1"
                        >
                          <Ban className="w-3 h-3" /> Suspender
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditPartner(partner)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePartner(partner)}
                        className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Excluir
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Sub-aba: Onboarding de Novos Parceiros */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleSubmitOnboarding}
            className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-base">Credenciamento de Parceiro</h3>
                <p className="text-slate-500 text-[11px]">
                  Cadastre seu perfil profissional para receber demandas de investidores e receber via Split Payment.
                </p>
              </div>
              {onboardingSuccess && (
                <span className="bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Cadastro enviado!
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Nome Completo ou Empresa *</label>
                <input
                  required
                  type="text"
                  value={newPartnerForm.name}
                  onChange={(e) => setNewPartnerForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Silva Reformas & Acabamentos"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Categoria Profissional *</label>
                <select
                  value={newPartnerForm.role}
                  onChange={(e) => setNewPartnerForm((p) => ({ ...p, role: e.target.value as Partner['role'] }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold"
                >
                  <option value="Corretor de Imóveis">Corretor de Imóveis</option>
                  <option value="Advogado Especialista">Advogado Especialista</option>
                  <option value="Administrador / Despachante">Administrador / Despachante</option>
                  <option value="Pedreiro / Reforma">Pedreiro / Reforma</option>
                  <option value="Engenheiro / Arquiteto">Engenheiro / Arquiteto</option>
                  <option value="Avaliador Imobiliário">Avaliador Imobiliário</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Registro / Documento (OAB, CRECI, CREA ou CNPJ/CPF)</label>
                <input
                  type="text"
                  value={newPartnerForm.registrationCode}
                  onChange={(e) => setNewPartnerForm((p) => ({ ...p, registrationCode: e.target.value }))}
                  placeholder="Ex: CRECI/SP 123.456 ou CNPJ"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <label className="font-bold text-slate-700 block">Cidade *</label>
                  <input
                    required
                    type="text"
                    value={newPartnerForm.city}
                    onChange={(e) => setNewPartnerForm((p) => ({ ...p, city: e.target.value }))}
                    placeholder="São Paulo"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">UF</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={newPartnerForm.state}
                    onChange={(e) => setNewPartnerForm((p) => ({ ...p, state: e.target.value.toUpperCase() }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">WhatsApp para Contato</label>
                <input
                  type="text"
                  value={newPartnerForm.phone}
                  onChange={(e) => setNewPartnerForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Chave Pix / Subconta Split</label>
                <input
                  type="text"
                  value={newPartnerForm.pixKey}
                  onChange={(e) => setNewPartnerForm((p) => ({ ...p, pixKey: e.target.value }))}
                  placeholder="CPF, CNPJ ou e-mail para repasse"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Serviço Principal Ofertado</label>
                <input
                  type="text"
                  value={newPartnerForm.serviceTitle}
                  onChange={(e) => setNewPartnerForm((p) => ({ ...p, serviceTitle: e.target.value }))}
                  placeholder="Ex: Vistoria Técnica / Pintura Completa"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Preço Inicial (R$)</label>
                <input
                  type="number"
                  min={50}
                  value={newPartnerForm.startingPrice}
                  onChange={(e) => setNewPartnerForm((p) => ({ ...p, startingPrice: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">Resumo da Experiência</label>
              <textarea
                rows={3}
                value={newPartnerForm.specialty}
                onChange={(e) => setNewPartnerForm((p) => ({ ...p, specialty: e.target.value }))}
                placeholder="Descreva sua atuação em imóveis de leilão, região atendida e diferenciais..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium"
              />
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-3 rounded-xl text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm hover:opacity-95"
              style={{ backgroundColor: tenant.primaryColor }}
            >
              <span>Enviar Cadastro para Homologação</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Card Explicativo do Modelo Split Payment */}
          <div className="bg-slate-900 text-white p-6 rounded-3xl space-y-4 text-xs flex flex-col justify-between">
            <div className="space-y-3">
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full text-[10px] font-black uppercase inline-flex items-center gap-1">
                <Lock className="w-3 h-3" /> Split Payment & Escrow
              </span>
              <h3 className="text-lg font-black leading-snug">
                Como funciona a monetização e segurança dos pagamentos
              </h3>
              <ul className="space-y-2.5 text-slate-300 leading-relaxed">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Zero Bitributação:</strong> O gateway (Asaas / Pagar.me / Stripe) divide o pagamento na liquidação. A plataforma emite NF apenas sobre o seu fee ({tenant.platformFeePct}%).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Proteção Escrow:</strong> O cliente paga no início, o valor fica garantido e é liberado ao parceiro na entrega da etapa.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Compatível com White-Label:</strong> Cada licenciado pode receber uma comissão configurável ({tenant.tenantFeePct}%) sobre ordens da sua carteira.
                  </span>
                </li>
              </ul>
            </div>

            <div className="bg-white/10 p-3.5 rounded-2xl border border-white/10 text-[11px] text-slate-200">
              <strong className="block text-white mb-0.5">Exemplo em um serviço de R$ 1.000:</strong>
              Fee Plataforma ({tenant.platformFeePct}%): R$ {(1000 * (tenant.platformFeePct / 100)).toFixed(0)} •
              {tenant.tenantFeePct > 0 && ` Fee Licenciado (${tenant.tenantFeePct}%): R$ ${(1000 * (tenant.tenantFeePct / 100)).toFixed(0)} • `}
              Repasse Parceiro: R$ {(1000 * (1 - (tenant.platformFeePct + tenant.tenantFeePct) / 100)).toFixed(0)}
            </div>
          </div>
        </div>
      )}

      {/* Modal Checkout com Split Payment */}
      {checkoutPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={checkoutPartner.avatar}
                  alt={checkoutPartner.name}
                  className="w-10 h-10 rounded-xl object-cover border border-white/20"
                />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                    Contratação Protegida • Escrow + Split
                  </span>
                  <h3 className="font-black text-sm text-white">{checkoutPartner.name}</h3>
                </div>
              </div>
              <button
                onClick={() => setCheckoutPartner(null)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              {/* Seleção de Pacote / Serviço */}
              <div className="space-y-2">
                <label className="font-black text-slate-800 uppercase text-[10px] block">
                  1. Escolha o Serviço ou Informe o Valor Combinado
                </label>
                <div className="space-y-2">
                  {(checkoutPartner.services || []).map((srv) => {
                    const active = selectedServiceId === srv.id;
                    return (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => setSelectedServiceId(srv.id)}
                        className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 ${
                          active
                            ? 'border-slate-900 bg-slate-50 shadow-2xs'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <span className="font-black text-slate-900 block">{srv.title}</span>
                          <span className="text-[11px] text-slate-500 block mt-0.5">{srv.description}</span>
                          <span className="text-[10px] font-bold text-slate-400 mt-1 inline-block">
                            Prazo estimado: {srv.turnaroundDays} dias • {srv.billingModel}
                          </span>
                        </div>
                        <span className="font-black text-sm text-emerald-700 shrink-0">
                          {formatCurrencyBRL(srv.price)}
                        </span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setSelectedServiceId('custom')}
                    className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                      selectedServiceId === 'custom'
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-bold text-slate-800">Outro valor / Orçamento personalizado</span>
                    <span className="text-[11px] text-slate-500">Definir abaixo</span>
                  </button>
                </div>

                {selectedServiceId === 'custom' && (
                  <div className="pt-2">
                    <label className="font-bold text-slate-600 block mb-1">Valor Total do Serviço (R$)</label>
                    <input
                      type="number"
                      min={50}
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-black text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Gateway Split */}
              <div className="space-y-2">
                <label className="font-black text-slate-800 uppercase text-[10px] block">
                  2. Provedor de Split Payment
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Asaas Split', 'Pagar.me Split', 'Stripe Connect'] as const).map((prov) => (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => setSplitProvider(prov)}
                      className={`py-2 px-2 rounded-xl border font-bold text-[11px] transition-all ${
                        splitProvider === prov
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {prov}
                    </button>
                  ))}
                </div>
              </div>

              {/* Demonstrativo Transparente do Split */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="font-black text-slate-900 flex items-center gap-1.5">
                    <Percent className="w-4 h-4 text-blue-600" /> Divisão Automática na Fonte (Split)
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">{splitProvider}</span>
                </div>

                <div className="flex justify-between text-slate-700">
                  <span>Valor Total Pago pelo Cliente (Pix/Cartão)</span>
                  <strong className="text-slate-900">{formatCurrencyBRL(grossAmount)}</strong>
                </div>

                <div className="flex justify-between text-blue-700">
                  <span>Fee Proprietário da Plataforma ({splitBreakdown.platformPct}%)</span>
                  <strong>- {formatCurrencyBRL(splitBreakdown.platformFee)}</strong>
                </div>

                {splitBreakdown.tenantPct > 0 && (
                  <div className="flex justify-between text-purple-700">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> Comissão Licenciado White-Label ({splitBreakdown.tenantPct}%)
                    </span>
                    <strong>- {formatCurrencyBRL(splitBreakdown.tenantFee)}</strong>
                  </div>
                )}

                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm">
                  <span className="font-black text-emerald-800">Repasse Líquido ao Parceiro</span>
                  <strong className="font-black text-emerald-700">{formatCurrencyBRL(splitBreakdown.partnerNet)}</strong>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                onClick={() => setCheckoutPartner(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmOrder}
                disabled={grossAmount <= 0}
                className="px-5 py-2.5 rounded-xl text-white font-black text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                style={{ backgroundColor: tenant.primaryColor }}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Simular Contratação em Escrow</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Edição Admin de Parceiro */}
      {editingPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={handleSavePartnerEdit}
            className="bg-white w-full max-w-xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-xs"
          >
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                  Edição Admin de Stakeholder
                </span>
                <h3 className="font-black text-sm">{editingPartner.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPartner(null)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="font-bold text-slate-700 block">Nome / Empresa *</label>
                <input
                  required
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Categoria</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as Partner['role'] }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                >
                  <option value="Corretor de Imóveis">Corretor de Imóveis</option>
                  <option value="Advogado Especialista">Advogado Especialista</option>
                  <option value="Administrador / Despachante">Administrador / Despachante</option>
                  <option value="Despachante Imobiliário">Despachante Imobiliário</option>
                  <option value="Pedreiro / Reforma">Pedreiro / Reforma</option>
                  <option value="Engenheiro / Arquiteto">Engenheiro / Arquiteto</option>
                  <option value="Avaliador Imobiliário">Avaliador Imobiliário</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Status de Homologação</label>
                <select
                  value={editForm.dbStatus}
                  onChange={(e) => setEditForm((f) => ({ ...f, dbStatus: e.target.value as PartnerApprovalDb }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                >
                  <option value="APPROVED">Homologado</option>
                  <option value="PENDING">Em Homologação (Pendente)</option>
                  <option value="SUSPENDED">Suspenso</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Cidade *</label>
                <input
                  required
                  type="text"
                  value={editForm.city}
                  onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">UF *</label>
                <input
                  required
                  type="text"
                  maxLength={2}
                  value={editForm.state}
                  onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold uppercase"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Registro (OAB/CRECI/CNPJ)</label>
                <input
                  type="text"
                  value={editForm.registrationCode}
                  onChange={(e) => setEditForm((f) => ({ ...f, registrationCode: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">E-mail</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Chave PIX (Split)</label>
                <input
                  type="text"
                  value={editForm.pixKey}
                  onChange={(e) => setEditForm((f) => ({ ...f, pixKey: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Preço Inicial (R$)</label>
                <input
                  type="number"
                  min={50}
                  value={editForm.startingPrice}
                  onChange={(e) => setEditForm((f) => ({ ...f, startingPrice: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="font-bold text-slate-700 block">Especialidade</label>
                <textarea
                  rows={2}
                  value={editForm.specialty}
                  onChange={(e) => setEditForm((f) => ({ ...f, specialty: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingPartner(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingPartner}
                className="px-5 py-2 rounded-xl text-white font-black disabled:opacity-50"
                style={{ backgroundColor: tenant.primaryColor }}
              >
                {savingPartner ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
