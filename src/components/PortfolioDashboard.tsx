import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Property, UserProfile, LedgerEntry } from '../types/auction';
import { formatCurrencyBRL } from '../utils/financial';
import { useTenant } from '../config/tenant';
import { useAuth } from '../config/auth';
import {
  convertBrlToQuotas,
  convertQuotasToBrl,
  computeOwnershipPct,
  computeProRataAmount,
  computeExitFeeWaterfall,
  formatQuotas,
  getHurdleLabel,
  type InvestmentVehicle,
  type QuotaLedgerEvent,
  type QuotaSubscriptionIntent,
  type VehicleDocument,
  type HurdleType,
  type VehicleType,
  type LegalStructure,
  type VehicleStage,
  type AdminFeeMode,
} from '../utils/quotaEngine';
import {
  fetchInvestorPortalData,
  createQuotaIntent,
  cancelQuotaIntent,
  createInvestmentVehicle,
  convertIntentToQuotas,
  updateVehicleStageAndNav,
  createCapitalCallOrExpense,
  executeVehicleLiquidation,
  exportQuotaLedgerCsv,
  FALLBACK_REFERENCE_VEHICLES,
  type CapitalCall,
} from '../utils/investorService';
import {
  PieChart as PieChartIcon,
  Layers,
  Calculator,
  FileText,
  ShieldCheck,
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
  Download,
  LogIn,
  Sparkles,
  Scale,
  ArrowRight,
  Info,
  Settings2,
  PlusCircle,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';

interface PortfolioDashboardProps {
  userProfile?: UserProfile;
  properties?: Property[];
  onSelectProperty?: (property: Property) => void;
  onOpenAuth?: () => void;
  ledgerEntries?: LedgerEntry[];
}

type InvestorSubTab = 'operacoes' | 'simulador' | 'extrato' | 'governanca' | 'gestao';
type VehicleFilter = 'ALL' | 'SINGLE_ASSET' | 'MULTI_ASSET_POOL';

const STAGE_LABELS: Record<InvestmentVehicle['stage'], string> = {
  CAPTACAO: 'Em Captação',
  ARREMATACAO: 'Arrematação',
  DESOCUPACAO: 'Desocupação',
  REFORMA: 'Em Reforma',
  VENDA: 'À Venda (Exit)',
  ENCERRADO: 'Encerrado',
};

const INTENT_STATUS_META: Record<
  QuotaSubscriptionIntent['status'],
  { label: string; badge: string }
> = {
  PENDING: { label: 'Aguardando Análise / Chamada', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  APPROVED: { label: 'Aprovada p/ Integralização', badge: 'bg-sky-50 text-sky-800 border-sky-200' },
  CONVERTED: { label: 'Convertida em Cotas', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  CANCELLED: { label: 'Cancelada', badge: 'bg-slate-100 text-slate-500 border-slate-200' },
};

export const PortfolioDashboard: React.FC<PortfolioDashboardProps> = ({
  properties = [],
  onOpenAuth,
  ledgerEntries = [],
}) => {
  const { tenant } = useTenant();
  const { user } = useAuth();

  const canManageQuotas = Boolean(user?.isManager || tenant.features.adminSync);

  const [subTab, setSubTab] = useState<InvestorSubTab>('operacoes');
  const [vehicleFilter, setVehicleFilter] = useState<VehicleFilter>('ALL');
  const [vehicles, setVehicles] = useState<InvestmentVehicle[]>(FALLBACK_REFERENCE_VEHICLES);
  const [ledgerEvents, setLedgerEvents] = useState<QuotaLedgerEvent[]>([]);
  const [intents, setIntents] = useState<QuotaSubscriptionIntent[]>([]);
  const [allIntents, setAllIntents] = useState<QuotaSubscriptionIntent[]>([]);
  const [capitalCalls, setCapitalCalls] = useState<CapitalCall[]>([]);
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncedFromCloud, setSyncedFromCloud] = useState<boolean>(false);

  // Drawer inline de Intenção de Aporte em Cotas
  const [selectedVehicle, setSelectedVehicle] = useState<InvestmentVehicle | null>(null);
  const [intentAmountInput, setIntentAmountInput] = useState<string>('10000');
  const [intentNotes, setIntentNotes] = useState<string>('');
  const [submittingIntent, setSubmittingIntent] = useState<boolean>(false);
  const [intentFeedback, setIntentFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Simulador Interativo de Cotas & Taxas
  const [simInvested, setSimInvested] = useState<number>(25000);
  const [simQuotaNominal, setSimQuotaNominal] = useState<number>(1000);
  const [simMonths, setSimMonths] = useState<number>(10);
  const [simGrossRoiPct, setSimGrossRoiPct] = useState<number>(32);
  const [simAdminFeePct, setSimAdminFeePct] = useState<number>(0);
  const [simPerfFeePct, setSimPerfFeePct] = useState<number>(20);
  const [simHurdleType, setSimHurdleType] = useState<HurdleType>('CDI');
  const [simHurdleAnnualPct, setSimHurdleAnnualPct] = useState<number>(10.75);

  // Fase 3: Estados do Painel do Gestor
  const [managerMsg, setManagerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [managerBusy, setManagerBusy] = useState<boolean>(false);

  const [newOpName, setNewOpName] = useState<string>('');
  const [newOpType, setNewOpType] = useState<VehicleType>('SINGLE_ASSET');
  const [newOpLegal, setNewOpLegal] = useState<LegalStructure>('SCP');
  const [newOpPropertyId, setNewOpPropertyId] = useState<string>('');
  const [newOpCity, setNewOpCity] = useState<string>('');
  const [newOpState, setNewOpState] = useState<string>('SP');
  const [newOpSummary, setNewOpSummary] = useState<string>('');
  const [newOpQuotaNominal, setNewOpQuotaNominal] = useState<number>(1000);
  const [newOpMinInvest, setNewOpMinInvest] = useState<number>(5000);
  const [newOpTargetCapital, setNewOpTargetCapital] = useState<number>(350000);
  const [newOpExitMonths, setNewOpExitMonths] = useState<number>(10);
  const [newOpProjRoi, setNewOpProjRoi] = useState<number>(32);
  const [newOpAdminFee, setNewOpAdminFee] = useState<number>(0);
  const [newOpAdminMode, setNewOpAdminMode] = useState<AdminFeeMode>('ON_EXIT_ACCRUED');
  const [newOpPerfFee, setNewOpPerfFee] = useState<number>(20);
  const [newOpHurdleType, setNewOpHurdleType] = useState<HurdleType>('CDI');
  const [newOpHurdlePct, setNewOpHurdlePct] = useState<number>(10.75);

  const [mgrVehicleId, setMgrVehicleId] = useState<string>('');
  const [mgrStage, setMgrStage] = useState<VehicleStage>('REFORMA');
  const [mgrNavInput, setMgrNavInput] = useState<string>('');
  const [mgrNavNote, setMgrNavNote] = useState<string>('');

  const [callKind, setCallKind] = useState<'EXPENSE' | 'CAPITAL_CALL'>('CAPITAL_CALL');
  const [callTitle, setCallTitle] = useState<string>('');
  const [callAmount, setCallAmount] = useState<string>('15000');
  const [callDueDate, setCallDueDate] = useState<string>(() =>
    new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10)
  );

  const [liqSaleProceeds, setLiqSaleProceeds] = useState<string>('480000');
  const [liqMonths, setLiqMonths] = useState<number>(10);

  const loadPortalData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchInvestorPortalData(user?.id, user?.isDemoSession, canManageQuotas);
      setVehicles(res.vehicles);
      setLedgerEvents(res.ledgerEvents);
      setIntents(res.intents);
      setAllIntents(res.allIntents);
      setCapitalCalls(res.capitalCalls);
      setDocuments(res.documents);
      setSyncedFromCloud(res.syncedFromSupabase);
      if (res.vehicles.length > 0 && !mgrVehicleId) {
        const first = res.vehicles[0];
        setMgrVehicleId(first.id);
        setMgrStage(first.stage);
        setMgrNavInput(String(first.current_nav_per_quota));
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.isDemoSession, canManageQuotas, mgrVehicleId]);

  useEffect(() => {
    loadPortalData();
  }, [loadPortalData]);

  const vehiclesById = useMemo(() => {
    const map: Record<string, InvestmentVehicle> = {};
    for (const v of vehicles) map[v.id] = v;
    return map;
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    if (vehicleFilter === 'ALL') return vehicles;
    return vehicles.filter((v) => v.vehicle_type === vehicleFilter);
  }, [vehicles, vehicleFilter]);

  const positionSummary = useMemo(() => {
    const quotasByVehicle: Record<string, number> = {};
    let totalInvestedBrl = 0;
    let totalDistributedBrl = 0;

    for (const ev of ledgerEvents) {
      if (ev.user_id && user?.id && ev.user_id !== user.id) continue;
      if (!ev.user_id) continue;
      if (ev.quotas_delta !== 0) {
        quotasByVehicle[ev.vehicle_id] = (quotasByVehicle[ev.vehicle_id] || 0) + ev.quotas_delta;
      }
      if (ev.event_type === 'SUBSCRIPTION' || ev.event_type === 'CAPITAL_CALL') {
        totalInvestedBrl += Math.abs(ev.amount_brl);
      } else if (ev.event_type === 'DISTRIBUTION' || ev.event_type === 'REDEMPTION') {
        totalDistributedBrl += Math.abs(ev.amount_brl);
      }
    }

    let totalQuotas = 0;
    let totalNavBrl = 0;
    let activeVehiclesCount = 0;

    for (const [vid, q] of Object.entries(quotasByVehicle)) {
      if (q > 0.000001) {
        activeVehiclesCount += 1;
        totalQuotas += q;
        const nav = vehiclesById[vid]?.current_nav_per_quota || 0;
        totalNavBrl += convertQuotasToBrl(q, nav);
      }
    }

    const activeIntents = intents.filter((i) => i.status === 'PENDING' || i.status === 'APPROVED');
    const reservedBrl = activeIntents.reduce((acc, i) => acc + i.amount_brl, 0);
    const reservedQuotas = activeIntents.reduce((acc, i) => acc + i.estimated_quotas, 0);

    return {
      totalQuotas,
      totalNavBrl,
      totalInvestedBrl,
      totalDistributedBrl,
      activeVehiclesCount,
      reservedBrl,
      reservedQuotas,
      activeIntentsCount: activeIntents.length,
      quotasByVehicle,
    };
  }, [ledgerEvents, intents, vehiclesById, user?.id]);

  const intentPreview = useMemo(() => {
    if (!selectedVehicle) return null;
    const amount = Math.max(0, Number(intentAmountInput) || 0);
    const estQuotas = convertBrlToQuotas(amount, selectedVehicle.current_nav_per_quota);
    const postTotalQuotas = selectedVehicle.total_quotas_issued + estQuotas;
    const estOwnershipPct = computeOwnershipPct(estQuotas, postTotalQuotas);
    const grossProfit = amount * (selectedVehicle.projected_roi_pct / 100);
    const waterfall = computeExitFeeWaterfall({
      investedCapital: amount,
      grossProfitBrl: grossProfit,
      holdingMonths: selectedVehicle.estimated_exit_months,
      adminFeeAnnualPct: selectedVehicle.admin_fee_annual_pct,
      performanceFeePct: selectedVehicle.performance_fee_pct,
      hurdleType: selectedVehicle.performance_hurdle_type,
      hurdleAnnualPct: selectedVehicle.performance_hurdle_annual_pct,
    });
    return { amount, estQuotas, estOwnershipPct, waterfall };
  }, [selectedVehicle, intentAmountInput]);

  const simWaterfall = useMemo(() => {
    const grossProfit = simInvested * (simGrossRoiPct / 100);
    return computeExitFeeWaterfall({
      investedCapital: simInvested,
      grossProfitBrl: grossProfit,
      holdingMonths: simMonths,
      adminFeeAnnualPct: simAdminFeePct,
      performanceFeePct: simPerfFeePct,
      hurdleType: simHurdleType,
      hurdleAnnualPct: simHurdleAnnualPct,
    });
  }, [
    simInvested,
    simGrossRoiPct,
    simMonths,
    simAdminFeePct,
    simPerfFeePct,
    simHurdleType,
    simHurdleAnnualPct,
  ]);

  const simBenchmarkChart = useMemo(() => {
    const years = Math.max(1, simMonths) / 12;
    const cdiRoi = (Math.pow(1 + 0.1075, years) - 1) * 100;
    const ipca6Roi = (Math.pow(1 + 0.105, years) - 1) * 100;
    const poupancaRoi = (Math.pow(1 + 0.068, years) - 1) * 100;
    return [
      { name: 'Poupança', roi: Number(poupancaRoi.toFixed(1)), fill: '#94a3b8' },
      { name: 'IPCA + 6%', roi: Number(ipca6Roi.toFixed(1)), fill: '#475569' },
      { name: '100% CDI', roi: Number(cdiRoi.toFixed(1)), fill: '#0284c7' },
      {
        name: 'Cota Líquida',
        roi: Number(simWaterfall.netRoiPct.toFixed(1)),
        fill: tenant.primaryColor || '#ea580c',
      },
    ];
  }, [simMonths, simWaterfall.netRoiPct, tenant.primaryColor]);

  const applySimulatorPreset = (preset: 'single' | 'pool') => {
    if (preset === 'single') {
      setSimQuotaNominal(1000);
      setSimMonths(10);
      setSimGrossRoiPct(32);
      setSimAdminFeePct(0);
      setSimPerfFeePct(20);
      setSimHurdleType('CDI');
      setSimHurdleAnnualPct(10.75);
    } else {
      setSimQuotaNominal(100);
      setSimMonths(14);
      setSimGrossRoiPct(36);
      setSimAdminFeePct(1.5);
      setSimPerfFeePct(20);
      setSimHurdleType('IPCA_PLUS_6');
      setSimHurdleAnnualPct(10.5);
    }
  };

  const openIntentDrawer = (vehicle: InvestmentVehicle) => {
    setSelectedVehicle(vehicle);
    setIntentAmountInput(String(Math.max(vehicle.min_investment_brl, 5000)));
    setIntentNotes('');
    setIntentFeedback(null);
  };

  const handleSubmitIntent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle || !intentPreview) return;

    if (!user) {
      onOpenAuth?.();
      return;
    }

    if (intentPreview.amount < selectedVehicle.min_investment_brl) {
      setIntentFeedback({
        type: 'error',
        text: `O aporte mínimo nesta operação é de ${formatCurrencyBRL(selectedVehicle.min_investment_brl)}.`,
      });
      return;
    }

    setSubmittingIntent(true);
    setIntentFeedback(null);
    try {
      const res = await createQuotaIntent({
        tenantId: tenant.id,
        vehicleId: selectedVehicle.id,
        userId: user.id,
        investorName: user.name,
        investorEmail: user.email,
        amountBrl: intentPreview.amount,
        estimatedQuotas: intentPreview.estQuotas,
        quotaPriceSnapshot: selectedVehicle.current_nav_per_quota,
        notes: intentNotes,
        isDemoSession: user.isDemoSession,
      });

      setIntents((prev) => [res.intent, ...prev]);
      if (canManageQuotas) {
        setAllIntents((prev) => [res.intent, ...prev]);
      }
      setIntentFeedback({
        type: 'success',
        text: res.savedToCloud
          ? `Intenção de ${formatQuotas(res.intent.estimated_quotas)} (${formatCurrencyBRL(res.intent.amount_brl)}) registrada no Supabase!`
          : `Intenção de ${formatQuotas(res.intent.estimated_quotas)} registrada localmente neste aparelho.`,
      });
      setIntentNotes('');
    } finally {
      setSubmittingIntent(false);
    }
  };

  const handleCancelIntent = async (intentId: string) => {
    const ok = await cancelQuotaIntent(intentId, user?.id, user?.isDemoSession);
    if (ok) {
      setIntents((prev) =>
        prev.map((it) => (it.id === intentId ? { ...it, status: 'CANCELLED' } : it))
      );
      setAllIntents((prev) =>
        prev.map((it) => (it.id === intentId ? { ...it, status: 'CANCELLED' } : it))
      );
    }
  };

  // Gestor: importar imóvel do catálogo para preencher criação de operação
  const handleSelectCatalogProperty = (propId: string) => {
    setNewOpPropertyId(propId);
    const found = properties.find((p) => p.id === propId);
    if (!found) return;
    setNewOpName(`SCP · ${found.title}`);
    setNewOpCity(found.address.city);
    setNewOpState(found.address.state);
    setNewOpTargetCapital(Math.max(50000, Math.round(found.secondAuctionPrice * 1.15)));
    setNewOpSummary(
      `${found.title} em ${found.address.city}/${found.address.state} (${found.bankName}). Lance ref. ${formatCurrencyBRL(found.secondAuctionPrice)} vs avaliação ${formatCurrencyBRL(found.appraisalValue)}.`
    );
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOpName.trim()) return;
    setManagerBusy(true);
    setManagerMsg(null);
    try {
      const res = await createInvestmentVehicle({
        tenantId: tenant.id,
        name: newOpName,
        vehicleType: newOpType,
        legalStructure: newOpLegal,
        propertyId: newOpPropertyId || null,
        propertySummary: newOpSummary,
        city: newOpCity,
        state: newOpState,
        initialQuotaValue: newOpQuotaNominal,
        targetCapital: newOpTargetCapital,
        minInvestmentBrl: newOpMinInvest,
        estimatedExitMonths: newOpExitMonths,
        projectedRoiPct: newOpProjRoi,
        adminFeeAnnualPct: newOpAdminFee,
        adminFeeMode: newOpAdminMode,
        performanceFeePct: newOpPerfFee,
        performanceHurdleType: newOpHurdleType,
        performanceHurdleAnnualPct: newOpHurdlePct,
      });

      if (res.ok && res.vehicle) {
        setVehicles((prev) => [...prev, res.vehicle!]);
        setMgrVehicleId(res.vehicle.id);
        setMgrStage(res.vehicle.stage);
        setMgrNavInput(String(res.vehicle.current_nav_per_quota));
        setManagerMsg({
          type: 'success',
          text: `Operação "${res.vehicle.name}" criada com cota inicial de ${formatCurrencyBRL(res.vehicle.initial_quota_value)}.`,
        });
        setNewOpName('');
        setNewOpSummary('');
      } else {
        setManagerMsg({
          type: 'error',
          text: res.error || 'Erro ao criar operação. Verifique se você está logado como gestor.',
        });
      }
    } finally {
      setManagerBusy(false);
    }
  };

  const handleConvertIntent = async (intent: QuotaSubscriptionIntent) => {
    const veh = vehiclesById[intent.vehicle_id];
    if (!veh) return;
    setManagerBusy(true);
    setManagerMsg(null);
    try {
      const res = await convertIntentToQuotas(intent, veh);
      if (res.ok) {
        setManagerMsg({
          type: 'success',
          text: `Intenção de ${intent.investor_email} integralizada com sucesso em cotas oficiais!`,
        });
        await loadPortalData();
      } else {
        setManagerMsg({ type: 'error', text: res.error || 'Erro ao integralizar cotas.' });
      }
    } finally {
      setManagerBusy(false);
    }
  };

  const selectedMgrVehicle = vehiclesById[mgrVehicleId] || vehicles[0];

  const handleUpdateStageAndNav = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMgrVehicle) return;
    setManagerBusy(true);
    setManagerMsg(null);
    try {
      const nextNav = Math.max(0.01, Number(mgrNavInput) || selectedMgrVehicle.current_nav_per_quota);
      const res = await updateVehicleStageAndNav(selectedMgrVehicle, mgrStage, nextNav, mgrNavNote);
      if (res.ok) {
        setManagerMsg({
          type: 'success',
          text: `Etapa atualizada para ${STAGE_LABELS[mgrStage]} e Cota NAV ajustada para ${formatCurrencyBRL(nextNav)}.`,
        });
        setMgrNavNote('');
        await loadPortalData();
      } else {
        setManagerMsg({ type: 'error', text: res.error || 'Falha ao atualizar etapa/NAV.' });
      }
    } finally {
      setManagerBusy(false);
    }
  };

  const handleRegisterCallOrExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMgrVehicle || !callTitle.trim()) return;
    const amt = Number(callAmount) || 0;
    if (amt <= 0) return;
    setManagerBusy(true);
    setManagerMsg(null);
    try {
      const res = await createCapitalCallOrExpense({
        vehicle: selectedMgrVehicle,
        kind: callKind,
        title: callTitle,
        amountBrl: amt,
        dueDate: callDueDate,
        createdByUserId: user?.id,
      });
      if (res.ok) {
        setManagerMsg({
          type: 'success',
          text:
            callKind === 'CAPITAL_CALL'
              ? `Chamada de capital "${callTitle}" (${formatCurrencyBRL(amt)}) aberta para os cotistas!`
              : `Despesa "${callTitle}" (${formatCurrencyBRL(amt)}) gravada no livro-razão!`,
        });
        setCallTitle('');
        await loadPortalData();
      } else {
        setManagerMsg({ type: 'error', text: res.error || 'Falha ao registrar evento.' });
      }
    } finally {
      setManagerBusy(false);
    }
  };

  const liquidationPreview = useMemo(() => {
    if (!selectedMgrVehicle) return null;
    const proceeds = Math.max(0, Number(liqSaleProceeds) || 0);
    const invested = selectedMgrVehicle.raised_capital || 0;
    const grossProfit = proceeds - invested;
    return computeExitFeeWaterfall({
      investedCapital: invested,
      grossProfitBrl: grossProfit,
      holdingMonths: liqMonths,
      adminFeeAnnualPct: selectedMgrVehicle.admin_fee_annual_pct,
      performanceFeePct: selectedMgrVehicle.performance_fee_pct,
      hurdleType: selectedMgrVehicle.performance_hurdle_type,
      hurdleAnnualPct: selectedMgrVehicle.performance_hurdle_annual_pct,
    });
  }, [selectedMgrVehicle, liqSaleProceeds, liqMonths]);

  const handleExecuteLiquidation = async () => {
    if (!selectedMgrVehicle) return;
    const proceeds = Math.max(0, Number(liqSaleProceeds) || 0);
    if (proceeds <= 0) return;
    setManagerBusy(true);
    setManagerMsg(null);
    try {
      const res = await executeVehicleLiquidation(
        selectedMgrVehicle,
        proceeds,
        liqMonths,
        ledgerEvents
      );
      if (res.ok) {
        setManagerMsg({
          type: 'success',
          text: `Operação encerrada! Distribuído líquido de ${formatCurrencyBRL(res.distributedTotalBrl)} para ${res.investorsCount} cotista(s).`,
        });
        await loadPortalData();
      } else {
        setManagerMsg({ type: 'error', text: res.error || 'Erro ao liquidar operação.' });
      }
    } finally {
      setManagerBusy(false);
    }
  };

  const proRataPreview = useMemo(() => {
    const v = selectedVehicle || vehicles[0];
    if (!v) return null;
    const totalVehicleExpenses = ledgerEntries.reduce((acc, e) => acc + e.amount, 0);
    const sampleQuotas =
      positionSummary.quotasByVehicle[v.id] || convertBrlToQuotas(10000, v.current_nav_per_quota);
    const denomQuotas = Math.max(v.total_quotas_issued, sampleQuotas, 1);
    const sharePct = computeOwnershipPct(sampleQuotas, denomQuotas);
    return {
      vehicle: v,
      totalVehicleExpenses,
      sampleQuotas,
      sharePct,
      yourShareBrl: computeProRataAmount(totalVehicleExpenses, sharePct),
    };
  }, [selectedVehicle, vehicles, ledgerEntries, positionSummary.quotasByVehicle]);

  const pendingQueue = useMemo(
    () => allIntents.filter((i) => i.status === 'PENDING' || i.status === 'APPROVED'),
    [allIntents]
  );

  return (
    <div className="space-y-6">
      {/* Banner Superior da Área do Investidor */}
      <div
        className="bg-white/95 backdrop-blur-md p-5 sm:p-6 rounded-3xl border shadow-sm space-y-4"
        style={{
          backgroundImage: `linear-gradient(135deg, ${tenant.primaryColor}10 0%, rgba(255,255,255,0.95) 55%, ${tenant.accentColor}10 100%)`,
          borderColor: `${tenant.primaryColor}26`,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span
                className="text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full"
                style={{ backgroundColor: tenant.primaryColor }}
              >
                Central em Cotas
              </span>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                {syncedFromCloud ? 'Sincronizado com Supabase' : 'Operações Modelo Ativas'}
              </span>
              {user?.isManager && (
                <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-black px-2.5 py-1 rounded-full">
                  Modo Gestor Ativo
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              Área do Investidor · {tenant.brandName}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Posição consolidada em cotas (Imóvel Individual SPE/SCP e Clube Multi-Imóveis), extrato rateado e simulador de retorno líquido.
            </p>
          </div>

          {!user ? (
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-4 py-2.5 rounded-xl text-white font-black text-xs flex items-center gap-2 shadow-sm hover:opacity-95"
              style={{ backgroundColor: tenant.primaryColor }}
            >
              <LogIn className="w-4 h-4" />
              <span>Entrar para Registrar Intenção</span>
            </button>
          ) : (
            <div className="bg-white/85 border border-slate-200 rounded-2xl px-3.5 py-2 text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Cotista Conectado</span>
              <span className="font-black text-slate-900">{user.name}</span>
              <span className="text-[11px] text-slate-500 block">{user.email}</span>
            </div>
          )}
        </div>

        {/* 4 KPIs Reais do Investidor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white/90 p-4 rounded-2xl border border-slate-200/90">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Cotas Integralizadas
            </span>
            <span className="text-xl font-black text-slate-900 block mt-1">
              {formatQuotas(positionSummary.totalQuotas, 4)}
            </span>
            <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
              {positionSummary.activeVehiclesCount > 0
                ? `Em ${positionSummary.activeVehiclesCount} operação(ões) ativa(s)`
                : 'Nenhuma cota integralizada ainda'}
            </span>
          </div>

          <div className="bg-white/90 p-4 rounded-2xl border border-slate-200/90">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Patrimônio Atual (NAV)
            </span>
            <span className="text-xl font-black text-emerald-700 block mt-1">
              {formatCurrencyBRL(positionSummary.totalNavBrl)}
            </span>
            <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
              Aportado: {formatCurrencyBRL(positionSummary.totalInvestedBrl)}
            </span>
          </div>

          <div className="bg-white/90 p-4 rounded-2xl border border-slate-200/90">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Intenções / Reservas Abertas
            </span>
            <span className="text-xl font-black text-slate-900 block mt-1">
              {formatCurrencyBRL(positionSummary.reservedBrl)}
            </span>
            <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
              {positionSummary.activeIntentsCount} reserva(s) · {formatQuotas(positionSummary.reservedQuotas, 2)}
            </span>
          </div>

          <div className="bg-white/90 p-4 rounded-2xl border border-slate-200/90">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Chamadas de Capital Abertas
            </span>
            <span className="text-xl font-black text-slate-900 block mt-1">
              {capitalCalls.filter((c) => c.status === 'OPEN').length} chamada(s)
            </span>
            <span className="text-[11px] text-emerald-700 font-bold block mt-0.5">
              Performance só na venda acima do CDI
            </span>
          </div>
        </div>

        {/* Navegação de Sub-abas */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {[
            { id: 'operacoes', label: 'Operações & Reservar Cotas', icon: Layers },
            { id: 'simulador', label: 'Simulador de Cotas & Taxas', icon: Calculator },
            { id: 'extrato', label: 'Extrato & Rateio', icon: PieChartIcon },
            { id: 'governanca', label: 'Governança & IR', icon: FileText },
            ...(canManageQuotas
              ? [
                  {
                    id: 'gestao',
                    label: `Gestão de Cotas (${pendingQueue.length})`,
                    icon: Settings2,
                  },
                ]
              : []),
          ].map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id as InvestorSubTab)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  active
                    ? 'text-white shadow-xs'
                    : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200'
                }`}
                style={active ? { backgroundColor: tenant.primaryColor } : undefined}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ABA 1: OPERAÇÕES EM COTAS & REGISTRO DE INTENÇÃO */}
      {subTab === 'operacoes' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', label: 'Todos os Modelos' },
                { id: 'SINGLE_ASSET', label: 'Imóvel Individual (SPE/SCP)' },
                { id: 'MULTI_ASSET_POOL', label: 'Clube Multi-Imóveis (Pool)' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setVehicleFilter(f.id as VehicleFilter)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    vehicleFilter === f.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {loading ? 'Carregando operações...' : `${filteredVehicles.length} veículo(s) em cotas disponíveis`}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredVehicles.map((v) => {
              const progressPct = v.target_capital > 0 ? Math.min(100, (v.raised_capital / v.target_capital) * 100) : 0;
              const isSingle = v.vehicle_type === 'SINGLE_ASSET';
              const navGainPct =
                v.initial_quota_value > 0
                  ? ((v.current_nav_per_quota - v.initial_quota_value) / v.initial_quota_value) * 100
                  : 0;
              const isSelected = selectedVehicle?.id === v.id;

              return (
                <div
                  key={v.id}
                  className={`bg-white p-5 rounded-3xl border shadow-xs flex flex-col justify-between space-y-4 transition-all ${
                    isSelected ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-200'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                          isSingle
                            ? 'bg-sky-50 text-sky-800 border-sky-200'
                            : 'bg-purple-50 text-purple-800 border-purple-200'
                        }`}
                      >
                        {isSingle ? 'Imóvel Individual (Deal-by-Deal)' : 'Clube / Pool Multi-Imóveis'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                          {v.legal_structure}
                        </span>
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                          {STAGE_LABELS[v.stage]}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-black text-base text-slate-900">{v.name}</h3>
                      {v.city && (
                        <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                          <Building2 className="w-3 h-3 inline mr-1" />
                          {v.city}/{v.state} · Exit estimado em {v.estimated_exit_months} meses
                        </span>
                      )}
                      {v.property_summary && (
                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">{v.property_summary}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Cota Atual (NAV)</span>
                        <span className="font-black text-slate-900 text-sm">
                          {formatCurrencyBRL(v.current_nav_per_quota)}
                        </span>
                        {navGainPct !== 0 && (
                          <span className="text-[10px] font-bold text-emerald-600 block">
                            +{navGainPct.toFixed(1)}% vs nominal
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Aporte Mínimo</span>
                        <span className="font-black text-slate-900 text-sm">
                          {formatCurrencyBRL(v.min_investment_brl)}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          ≈ {convertBrlToQuotas(v.min_investment_brl, v.current_nav_per_quota).toFixed(2)} cotas
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">ROI Bruto Alvo</span>
                        <span className="font-black text-emerald-700 text-sm">+{v.projected_roi_pct}%</span>
                        <span className="text-[10px] text-slate-500 block">Ciclo {v.estimated_exit_months}m</span>
                      </div>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between font-bold text-slate-700">
                        <span>Integralizado: {formatCurrencyBRL(v.raised_capital)}</span>
                        <span>Alvo: {formatCurrencyBRL(v.target_capital)} ({progressPct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${progressPct}%`, backgroundColor: tenant.primaryColor }}
                        />
                      </div>
                    </div>

                    <div className="text-[11px] bg-amber-50/70 border border-amber-200/80 rounded-xl px-3 py-2 text-amber-950 flex items-start gap-2">
                      <Scale className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                      <span>
                        <strong>Taxas:</strong> Adm {v.admin_fee_annual_pct.toFixed(1).replace('.', ',')}% a.a.
                        {v.admin_fee_mode === 'ON_EXIT_ACCRUED' ? ' (cobrada só na venda)' : ''} · Performance{' '}
                        {v.performance_fee_pct}% <strong>somente na venda</strong> acima de{' '}
                        <strong>{getHurdleLabel(v.performance_hurdle_type, v.performance_hurdle_annual_pct)}</strong>.
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openIntentDrawer(v)}
                    disabled={v.stage === 'ENCERRADO'}
                    className="w-full py-2.5 rounded-xl text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-2xs hover:opacity-95 disabled:opacity-40"
                    style={{ backgroundColor: tenant.primaryColor }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{v.stage === 'ENCERRADO' ? 'Operação Encerrada' : 'Reservar Cotas / Registrar Intenção'}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Formulário Inline: Registrar Intenção de Aporte em Cotas */}
          {selectedVehicle && intentPreview && (
            <form
              onSubmit={handleSubmitIntent}
              className="bg-white p-6 rounded-3xl border-2 border-slate-900 shadow-lg space-y-4 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">
                    Registro de Intenção de Aporte (Sem Débito Imediato)
                  </span>
                  <h3 className="text-base font-black text-slate-900">{selectedVehicle.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedVehicle(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Fechar
                </button>
              </div>

              {intentFeedback && (
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2 font-bold ${
                    intentFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{intentFeedback.text}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">
                      Quanto deseja aportar? (R$) · Mín. {formatCurrencyBRL(selectedVehicle.min_investment_brl)}
                    </label>
                    <input
                      type="number"
                      min={100}
                      step={100}
                      value={intentAmountInput}
                      onChange={(e) => setIntentAmountInput(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-black text-slate-900"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {[5000, 10000, 25000, 50000, 100000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setIntentAmountInput(String(val))}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px]"
                      >
                        {formatCurrencyBRL(val)}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Observação opcional (ex.: janela de liquidez)</label>
                    <input
                      type="text"
                      value={intentNotes}
                      onChange={(e) => setIntentNotes(e.target.value)}
                      placeholder="Ex: Interesse em 10% do ativo na próxima chamada"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Conversão Automática para Cotas
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Quantidade de Cotas</span>
                      <strong className="text-base font-black text-slate-900">
                        {formatQuotas(intentPreview.estQuotas, 4)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Participação Estimada</span>
                      <strong className="text-base font-black text-sky-700">
                        {intentPreview.estOwnershipPct.toFixed(2)}%
                      </strong>
                    </div>
                  </div>
                  <div className="border-t border-slate-200 pt-2 space-y-1 text-[11px] text-slate-600">
                    <div className="flex justify-between">
                      <span>Lucro bruto projetado ({selectedVehicle.projected_roi_pct}%):</span>
                      <strong className="text-slate-900">
                        {formatCurrencyBRL(intentPreview.waterfall.grossProfitBrl)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Taxa de Adm. acumulada:</span>
                      <strong>- {formatCurrencyBRL(intentPreview.waterfall.adminFeeBrl)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Performance ({selectedVehicle.performance_fee_pct}% sobre excedente do Hurdle):</span>
                      <strong>- {formatCurrencyBRL(intentPreview.waterfall.performanceFeeBrl)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>IR estimado (15% ganho de capital):</span>
                      <strong>- {formatCurrencyBRL(intentPreview.waterfall.estimatedIrBrl)}</strong>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200 text-xs">
                      <span className="font-black text-emerald-800">Retorno Líquido Projetado</span>
                      <strong className="font-black text-emerald-700">
                        {formatCurrencyBRL(intentPreview.waterfall.netFinalAmountBrl)} (+
                        {intentPreview.waterfall.netRoiPct.toFixed(1)}%)
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  A reserva não gera cobrança automática; o gestor enviará o contrato SCP/SPE para assinatura antes da integralização.
                </span>
                <button
                  type="submit"
                  disabled={submittingIntent}
                  className="px-5 py-2.5 rounded-xl text-white font-black text-xs flex items-center gap-2 shadow-sm hover:opacity-95 disabled:opacity-50"
                  style={{ backgroundColor: tenant.primaryColor }}
                >
                  <span>{user ? 'Confirmar Intenção de Aporte' : 'Entrar para Registrar Intenção'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* Lista de Intenções Registradas */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-black text-slate-900">Minhas Intenções & Reservas de Cotas ({intents.length})</span>
              <span className="text-[11px] text-slate-500">Conversão trava o preço da cota na data da solicitação</span>
            </div>
            {intents.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Você ainda não registrou nenhuma intenção de aporte. Clique em <strong>Reservar Cotas</strong> em uma das operações acima.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {intents.map((it) => {
                  const meta = INTENT_STATUS_META[it.status];
                  const vehName = vehiclesById[it.vehicle_id]?.name || it.vehicle_id;
                  return (
                    <div key={it.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-slate-900">{vehName}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.badge}`}>
                            {meta.label}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block">
                          Aporte: <strong className="text-slate-800">{formatCurrencyBRL(it.amount_brl)}</strong> ·{' '}
                          <strong className="text-slate-800">{formatQuotas(it.estimated_quotas, 4)}</strong> · Cota ref.:{' '}
                          {formatCurrencyBRL(it.quota_price_snapshot)} · {new Date(it.created_at).toLocaleDateString('pt-BR')}
                        </span>
                        {it.notes && <span className="text-[11px] text-slate-500 italic block">“{it.notes}”</span>}
                      </div>
                      {(it.status === 'PENDING' || it.status === 'APPROVED') && (
                        <button
                          type="button"
                          onClick={() => handleCancelIntent(it.id)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-600 font-bold text-[11px] flex items-center gap-1 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancelar</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 2: SIMULADOR INTERATIVO DE COTAS & TAXAS */}
      {subTab === 'simulador' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-base">Simulador de Cotas, Adm e Performance</h3>
                <p className="text-[11px] text-slate-500">
                  Compare o impacto da cota configurável e da performance somente acima do CDI.
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => applySimulatorPreset('single')}
                  className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-[11px]"
                >
                  Imóvel Único (0% Adm)
                </button>
                <button
                  type="button"
                  onClick={() => applySimulatorPreset('pool')}
                  className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold text-[11px]"
                >
                  Clube Pool (1,5% Adm)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Valor do Aporte (R$)</label>
                <input
                  type="number"
                  min={500}
                  step={500}
                  value={simInvested}
                  onChange={(e) => setSimInvested(Math.max(500, Number(e.target.value) || 0))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-black text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Valor Nominal da Cota (Configurável)</label>
                <input
                  type="number"
                  min={10}
                  step={10}
                  value={simQuotaNominal}
                  onChange={(e) => setSimQuotaNominal(Math.max(10, Number(e.target.value) || 100))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-black text-slate-900"
                />
                <span className="text-[10px] text-emerald-700 font-bold block">
                  Equivale a {formatQuotas(convertBrlToQuotas(simInvested, simQuotaNominal), 4)}
                </span>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Prazo até a Venda (meses)</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={simMonths}
                  onChange={(e) => setSimMonths(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Lucro Bruto do Imóvel no Ciclo (%)</label>
                <input
                  type="number"
                  min={0}
                  max={300}
                  step={1}
                  value={simGrossRoiPct}
                  onChange={(e) => setSimGrossRoiPct(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-black text-emerald-700"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Taxa de Administração (% a.a.)</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.25}
                  value={simAdminFeePct}
                  onChange={(e) => setSimAdminFeePct(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Taxa de Performance na Venda (%)</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  step={1}
                  value={simPerfFeePct}
                  onChange={(e) => setSimPerfFeePct(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Hurdle / Benchmark da Performance</label>
                <select
                  value={simHurdleType}
                  onChange={(e) => {
                    const next = e.target.value as HurdleType;
                    setSimHurdleType(next);
                    if (next === 'CDI') setSimHurdleAnnualPct(10.75);
                    if (next === 'IPCA_PLUS_6') setSimHurdleAnnualPct(10.5);
                    if (next === 'FIXED_ANNUAL') setSimHurdleAnnualPct(12);
                    if (next === 'NONE') setSimHurdleAnnualPct(0);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                >
                  <option value="CDI">100% do CDI no período (Recomendado)</option>
                  <option value="IPCA_PLUS_6">IPCA + 6% a.a. (Pool Longo Prazo)</option>
                  <option value="FIXED_ANNUAL">Taxa Fixa Mínima a.a.</option>
                  <option value="NONE">Qualquer lucro (Sem Hurdle)</option>
                </select>
              </div>

              {simHurdleType !== 'NONE' && (
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Taxa Anual do Benchmark (% a.a.)</label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    step={0.25}
                    value={simHurdleAnnualPct}
                    onChange={(e) => setSimHurdleAnnualPct(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-6 space-y-5 text-xs">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="font-black text-slate-900 text-sm">Cascata de Apuração na Venda (Exit)</h3>
                <span className="bg-emerald-50 text-emerald-800 font-black px-2.5 py-1 rounded-full border border-emerald-200">
                  MOIC {simWaterfall.moic.toFixed(2)}x · {simWaterfall.annualizedIrrPct}% a.a.
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-slate-700">
                  <span>Capital Aportado ({formatQuotas(convertBrlToQuotas(simInvested, simQuotaNominal), 2)})</span>
                  <strong className="text-slate-900">{formatCurrencyBRL(simWaterfall.investedCapital)}</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Lucro Bruto da Operação ({simGrossRoiPct}%)</span>
                  <strong className="text-emerald-700">+ {formatCurrencyBRL(simWaterfall.grossProfitBrl)}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>(-) Taxa de Administração ({simAdminFeePct}% a.a. pro-rata {simMonths}m)</span>
                  <strong>- {formatCurrencyBRL(simWaterfall.adminFeeBrl)}</strong>
                </div>
                <div className="flex justify-between text-sky-800 bg-sky-50 px-2.5 py-1.5 rounded-lg">
                  <span>Piso Benchmark ({getHurdleLabel(simHurdleType, simHurdleAnnualPct)})</span>
                  <strong>{formatCurrencyBRL(simWaterfall.hurdleBenchmarkBrl)}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>
                    (-) Taxa de Performance ({simPerfFeePct}% só sobre excedente de{' '}
                    {formatCurrencyBRL(simWaterfall.excessAboveHurdleBrl)})
                  </span>
                  <strong>
                    {simWaterfall.performanceFeeBrl === 0
                      ? 'R$ 0,00 (abaixo do piso!)'
                      : `- ${formatCurrencyBRL(simWaterfall.performanceFeeBrl)}`}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>(-) Provisão IR Ganho de Capital (15%)</span>
                  <strong>- {formatCurrencyBRL(simWaterfall.estimatedIrBrl)}</strong>
                </div>
                <div className="flex justify-between pt-2.5 border-t border-slate-200 text-sm">
                  <span className="font-black text-slate-900">Resgate Líquido do Cotista</span>
                  <strong className="font-black text-emerald-700">
                    {formatCurrencyBRL(simWaterfall.netFinalAmountBrl)} (+{simWaterfall.netRoiPct.toFixed(1)}%)
                  </strong>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <span className="font-black text-slate-900 text-xs block">
                Retorno Líquido da Cota vs Benchmarks ({simMonths} meses)
              </span>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={simBenchmarkChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 'bold' }} stroke="#64748b" />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} stroke="#64748b" />
                    <Tooltip formatter={(val: any) => [`${val}%`, 'Retorno no período']} />
                    <Bar dataKey="roi" radius={[8, 8, 0, 0]}>
                      {simBenchmarkChart.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: EXTRATO IMUTÁVEL, CHAMADAS DE CAPITAL & RATEIO PRO-RATA */}
      {subTab === 'extrato' && (
        <div className="space-y-5 text-xs">
          {capitalCalls.filter((c) => c.status === 'OPEN').length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 space-y-3">
              <h3 className="font-black text-amber-950 text-sm flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-700" /> Chamadas de Capital em Aberto
              </h3>
              <div className="space-y-2">
                {capitalCalls
                  .filter((c) => c.status === 'OPEN')
                  .map((c) => {
                    const v = vehiclesById[c.vehicle_id];
                    const myQuotas = positionSummary.quotasByVehicle[c.vehicle_id] || 0;
                    const sharePct = v ? computeOwnershipPct(myQuotas, v.total_quotas_issued) : 0;
                    const myDue = computeProRataAmount(c.total_call_brl, sharePct);
                    return (
                      <div key={c.id} className="bg-white p-3.5 rounded-2xl border border-amber-200/80 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="font-black text-slate-900 block">
                            {c.title} · <span className="text-slate-500 font-medium">{v?.name || c.vehicle_id}</span>
                          </span>
                          <span className="text-[11px] text-slate-600">
                            Total da chamada: <strong>{formatCurrencyBRL(c.total_call_brl)}</strong> · Vencimento:{' '}
                            <strong>{new Date(c.due_date).toLocaleDateString('pt-BR')}</strong>
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Sua Fração ({sharePct.toFixed(2)}%)</span>
                          <strong className="text-sm font-black text-amber-800">{formatCurrencyBRL(myDue)}</strong>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {proRataPreview && (
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 block">
                  Integração Livro Caixa → Rateio Automático por Cota
                </span>
                <h3 className="font-black text-slate-900 text-sm">
                  Despesas acumuladas no Livro Caixa: {formatCurrencyBRL(proRataPreview.totalVehicleExpenses)}
                </h3>
                <p className="text-slate-600 text-[11px]">
                  Para uma posição de <strong>{formatQuotas(proRataPreview.sampleQuotas, 4)}</strong> (
                  <strong>{proRataPreview.sharePct.toFixed(2)}%</strong> de participação em{' '}
                  {proRataPreview.vehicle.name}), a fração rateada seria de{' '}
                  <strong className="text-slate-900">{formatCurrencyBRL(proRataPreview.yourShareBrl)}</strong>.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  exportQuotaLedgerCsv(ledgerEvents, vehiclesById, user?.email || 'investidor@g2auction.com.br')
                }
                disabled={ledgerEvents.length === 0}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center gap-1.5 disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Extrato CSV (IR)</span>
              </button>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-black text-slate-900">Livro-Razão Imutável de Cotas</span>
              <span className="text-[11px] text-slate-500">{ledgerEvents.length} evento(s) registrado(s)</span>
            </div>
            {ledgerEvents.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-2">
                <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-700">Nenhum evento de cota integralizada ainda.</p>
                <p className="text-[11px] max-w-md mx-auto">
                  Assim que uma intenção registrada na aba <strong>Operações</strong> for liquidada pelo gestor, todos os aportes, chamadas de capital, despesas rateadas e distribuições aparecerão aqui em ordem cronológica imutável.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                      <th className="py-3 px-4">Data</th>
                      <th className="py-3 px-4">Operação</th>
                      <th className="py-3 px-4">Evento</th>
                      <th className="py-3 px-4">Descrição</th>
                      <th className="py-3 px-4 text-right">Cotas</th>
                      <th className="py-3 px-4 text-right">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledgerEvents.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{ev.event_date}</td>
                        <td className="py-3 px-4 font-medium text-slate-700">
                          {vehiclesById[ev.vehicle_id]?.name || ev.vehicle_id}
                        </td>
                        <td className="py-3 px-4 font-bold text-sky-700">{ev.event_type}</td>
                        <td className="py-3 px-4 text-slate-600">{ev.description}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {ev.quotas_delta !== 0 ? formatQuotas(ev.quotas_delta, 4) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900">
                          {formatCurrencyBRL(ev.amount_brl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 4: GOVERNANÇA, COMPLIANCE CVM & IR */}
      {subTab === 'governanca' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" /> Estrutura Jurídica & Compliance (Brasil)
            </h3>
            <ul className="space-y-2.5 text-slate-600 leading-relaxed">
              <li>
                <strong className="text-slate-900">1. SCP / SPE por Imóvel ou Clube Privado:</strong> cada veículo separa o patrimônio e o risco jurídico, com acesso restrito a cotistas autenticados (sem oferta pública indiscriminada fora da CVM 88).
              </li>
              <li>
                <strong className="text-slate-900">2. NAV & Cotas com 6 Casas Decimais:</strong> novos aportes entram sempre pelo Valor Patrimonial da Cota (NAV) vigente na data, evitando diluição injusta de cotistas antigos.
              </li>
              <li>
                <strong className="text-slate-900">3. Tributação Estimada (IR 15%):</strong> o demonstrativo de saída calcula automaticamente a provisão de 15% sobre o ganho de capital líquido na pessoa física e gera o histórico exportável em CSV.
              </li>
            </ul>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-sky-600" /> Pasta Digital de Documentos ({documents.length})
            </h3>
            {documents.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-[11px] text-slate-600">
                <p className="font-bold text-slate-800">Checklist padrão por operação integralizada:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Contrato Particular de SCP ou Acordo de Sócios da SPE (com hash SHA-256)</li>
                  <li>Edital do Leilão + Matrícula Atualizada + Auto de Arrematação</li>
                  <li>Comprovantes de Aporte & Chamadas de Capital</li>
                  <li>Informe Anual de Rendimentos e Ganho de Capital (IRPF)</li>
                </ul>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {documents.map((doc) => (
                  <div key={doc.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-900 block">{doc.title}</span>
                      <span className="text-[10px] text-slate-500">
                        {doc.doc_type} · {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    {doc.file_url && (
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700"
                      >
                        Abrir
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 5 (FASE 3): PAINEL DO GESTOR DE COTAS */}
      {subTab === 'gestao' && canManageQuotas && (
        <div className="space-y-6 text-xs">
          {managerMsg && (
            <div
              className={`p-3.5 rounded-2xl border font-bold flex items-center gap-2 ${
                managerMsg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{managerMsg.text}</span>
            </div>
          )}

          {/* 1. Fila de Intenções para Converter em Cotas */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-black text-slate-900">
                1. Fila de Intenções de Aporte ({pendingQueue.length} pendente(s))
              </span>
              <span className="text-[11px] text-slate-500">
                Ao liquidar, emite as cotas no Livro-Razão pelo NAV atual e atualiza a captação
              </span>
            </div>
            {pendingQueue.length === 0 ? (
              <div className="p-5 text-center text-slate-500">
                Nenhuma intenção pendente de integralização no momento.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingQueue.map((it) => {
                  const veh = vehiclesById[it.vehicle_id];
                  return (
                    <div key={it.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="font-black text-slate-900 block">
                          {it.investor_name || it.investor_email} ·{' '}
                          <span className="text-sky-700">{veh?.name || it.vehicle_id}</span>
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {it.investor_email} · Valor: <strong>{formatCurrencyBRL(it.amount_brl)}</strong> ·{' '}
                          {formatQuotas(it.estimated_quotas, 4)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={managerBusy}
                          onClick={() => handleConvertIntent(it)}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] disabled:opacity-50"
                        >
                          Liquidar & Emitir Cotas
                        </button>
                        <button
                          type="button"
                          disabled={managerBusy}
                          onClick={() => handleCancelIntent(it.id)}
                          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-600 font-bold text-[11px]"
                        >
                          Recusar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 2. Criar Nova Operação Cotizada */}
            <form
              onSubmit={handleCreateVehicle}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3.5"
            >
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4 text-emerald-600" /> 2. Criar Nova Operação Cotizada
                </h3>
                <p className="text-[11px] text-slate-500">
                  Importe um imóvel do catálogo ou abra um novo Clube Multi-Imóveis com cota configurável.
                </p>
              </div>

              {properties.length > 0 && (
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Importar Imóvel do Catálogo (Opcional)</label>
                  <select
                    value={newOpPropertyId}
                    onChange={(e) => handleSelectCatalogProperty(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium"
                  >
                    <option value="">-- Preenchimento manual --</option>
                    {properties.slice(0, 30).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.address.city}/{p.address.state}) — {formatCurrencyBRL(p.secondAuctionPrice)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-bold text-slate-700 block">Nome da Operação / Fundo *</label>
                  <input
                    required
                    type="text"
                    value={newOpName}
                    onChange={(e) => setNewOpName(e.target.value)}
                    placeholder="Ex: SCP Apto Santana/SP — Edital Caixa"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Modelo</label>
                  <select
                    value={newOpType}
                    onChange={(e) => setNewOpType(e.target.value as VehicleType)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  >
                    <option value="SINGLE_ASSET">Imóvel Individual (Deal-by-Deal)</option>
                    <option value="MULTI_ASSET_POOL">Clube Multi-Imóveis (Pool)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Estrutura Jurídica</label>
                  <select
                    value={newOpLegal}
                    onChange={(e) => setNewOpLegal(e.target.value as LegalStructure)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  >
                    <option value="SCP">SCP</option>
                    <option value="SPE">SPE</option>
                    <option value="CONDOMINIO">Condomínio</option>
                    <option value="CLUBE_PRIVADO">Clube Privado</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Cota Nominal (R$)</label>
                  <input
                    type="number"
                    min={10}
                    value={newOpQuotaNominal}
                    onChange={(e) => setNewOpQuotaNominal(Math.max(10, Number(e.target.value) || 100))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Capital Alvo (R$)</label>
                  <input
                    type="number"
                    min={10000}
                    value={newOpTargetCapital}
                    onChange={(e) => setNewOpTargetCapital(Math.max(10000, Number(e.target.value) || 100000))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Aporte Mínimo (R$)</label>
                  <input
                    type="number"
                    min={500}
                    value={newOpMinInvest}
                    onChange={(e) => setNewOpMinInvest(Math.max(500, Number(e.target.value) || 1000))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Taxa Adm (% a.a.)</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.25}
                    value={newOpAdminFee}
                    onChange={(e) => setNewOpAdminFee(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Cobrança da Adm</label>
                  <select
                    value={newOpAdminMode}
                    onChange={(e) => setNewOpAdminMode(e.target.value as AdminFeeMode)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  >
                    <option value="ON_EXIT_ACCRUED">Acumulada só na Venda</option>
                    <option value="PERIODIC">Periódica</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Performance (% na venda)</label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={newOpPerfFee}
                    onChange={(e) => setNewOpPerfFee(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Hurdle / Piso</label>
                  <select
                    value={newOpHurdleType}
                    onChange={(e) => {
                      const next = e.target.value as HurdleType;
                      setNewOpHurdleType(next);
                      if (next === 'CDI') setNewOpHurdlePct(10.75);
                      if (next === 'IPCA_PLUS_6') setNewOpHurdlePct(10.5);
                      if (next === 'NONE') setNewOpHurdlePct(0);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  >
                    <option value="CDI">100% CDI</option>
                    <option value="IPCA_PLUS_6">IPCA + 6%</option>
                    <option value="FIXED_ANNUAL">Taxa Fixa</option>
                    <option value="NONE">Sem Hurdle</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Benchmark (% a.a.)</label>
                  <input
                    type="number"
                    step={0.25}
                    value={newOpHurdlePct}
                    onChange={(e) => setNewOpHurdlePct(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Prazo Exit (meses)</label>
                  <input
                    type="number"
                    min={1}
                    value={newOpExitMonths}
                    onChange={(e) => setNewOpExitMonths(Math.max(1, Number(e.target.value) || 10))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">ROI Bruto Alvo (%)</label>
                  <input
                    type="number"
                    min={1}
                    value={newOpProjRoi}
                    onChange={(e) => setNewOpProjRoi(Math.max(1, Number(e.target.value) || 25))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={managerBusy}
                className="w-full py-2.5 rounded-xl text-white font-black shadow-xs hover:opacity-95 disabled:opacity-50"
                style={{ backgroundColor: tenant.primaryColor }}
              >
                Publicar Operação em Cotas
              </button>
            </form>

            {/* 3. Etapa, NAV, Chamada de Capital & Liquidação na Venda */}
            <div className="space-y-5">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <label className="font-black text-slate-900 text-sm block">
                  3. Gerenciar Operação Existente
                </label>
                <select
                  value={selectedMgrVehicle?.id || ''}
                  onChange={(e) => {
                    const v = vehiclesById[e.target.value];
                    setMgrVehicleId(e.target.value);
                    if (v) {
                      setMgrStage(v.stage);
                      setMgrNavInput(String(v.current_nav_per_quota));
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({STAGE_LABELS[v.stage]})
                    </option>
                  ))}
                </select>

                <form onSubmit={handleUpdateStageAndNav} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Etapa Atual</label>
                    <select
                      value={mgrStage}
                      onChange={(e) => setMgrStage(e.target.value as VehicleStage)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 font-bold"
                    >
                      {Object.entries(STAGE_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Novo Valor da Cota NAV (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={mgrNavInput}
                      onChange={(e) => setMgrNavInput(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 font-black"
                    />
                  </div>
                  <input
                    type="text"
                    value={mgrNavNote}
                    onChange={(e) => setMgrNavNote(e.target.value)}
                    placeholder="Motivo da marcação (ex.: Imóvel desocupado / laudo atualização)"
                    className="sm:col-span-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium"
                  />
                  <button
                    type="submit"
                    disabled={managerBusy}
                    className="sm:col-span-2 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
                  >
                    Atualizar Etapa & Marcação NAV
                  </button>
                </form>
              </div>

              {/* Chamada de Capital ou Despesa Rateada */}
              <form
                onSubmit={handleRegisterCallOrExpense}
                className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2.5"
              >
                <span className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-amber-600" /> 4. Abrir Chamada de Capital / Lançar Despesa
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={callKind}
                    onChange={(e) => setCallKind(e.target.value as 'EXPENSE' | 'CAPITAL_CALL')}
                    className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 font-bold"
                  >
                    <option value="CAPITAL_CALL">Chamada de Capital</option>
                    <option value="EXPENSE">Despesa Rateada</option>
                  </select>
                  <input
                    type="number"
                    min={100}
                    value={callAmount}
                    onChange={(e) => setCallAmount(e.target.value)}
                    placeholder="Valor R$"
                    className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 font-black"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    required
                    type="text"
                    value={callTitle}
                    onChange={(e) => setCallTitle(e.target.value)}
                    placeholder="Ex: Reforma 2ª etapa / ITBI"
                    className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium"
                  />
                  <input
                    type="date"
                    value={callDueDate}
                    onChange={(e) => setCallDueDate(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>
                <button
                  type="submit"
                  disabled={managerBusy}
                  className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black"
                >
                  Registrar no Livro / Notificar Cotistas
                </button>
              </form>

              {/* Liquidação na Venda (Exit Waterfall) */}
              {selectedMgrVehicle && liquidationPreview && (
                <div className="bg-slate-900 text-white p-5 rounded-3xl space-y-3">
                  <span className="font-black text-sm block">5. Liquidação Final na Venda (Exit Waterfall)</span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] uppercase text-slate-400 block mb-1">Valor Bruto Venda (R$)</label>
                      <input
                        type="number"
                        value={liqSaleProceeds}
                        onChange={(e) => setLiqSaleProceeds(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-black text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-slate-400 block mb-1">Prazo Realizado (meses)</label>
                      <input
                        type="number"
                        min={1}
                        value={liqMonths}
                        onChange={(e) => setLiqMonths(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-black text-white"
                      />
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-2xl p-3 text-[11px] space-y-1 text-slate-200">
                    <div className="flex justify-between">
                      <span>Capital Integralizado:</span>
                      <strong>{formatCurrencyBRL(liquidationPreview.investedCapital)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Adm + Perf ({selectedMgrVehicle.performance_fee_pct}% &gt; Hurdle):</span>
                      <strong>
                        {formatCurrencyBRL(liquidationPreview.adminFeeBrl + liquidationPreview.performanceFeeBrl)}
                      </strong>
                    </div>
                    <div className="flex justify-between text-emerald-300 font-black pt-1 border-t border-white/10">
                      <span>Líquido Total p/ Cotistas (após IR 15%):</span>
                      <span>{formatCurrencyBRL(liquidationPreview.netFinalAmountBrl)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={managerBusy || selectedMgrVehicle.stage === 'ENCERRADO'}
                    onClick={handleExecuteLiquidation}
                    className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black disabled:opacity-40"
                  >
                    {selectedMgrVehicle.stage === 'ENCERRADO'
                      ? 'Operação Já Encerrada'
                      : 'Executar Liquidação & Distribuir Cotas'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
