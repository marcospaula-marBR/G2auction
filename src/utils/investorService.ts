import { supabase } from '../lib/supabaseClient';
import {
  convertBrlToQuotas,
  computeOwnershipPct,
  computeExitFeeWaterfall,
  type InvestmentVehicle,
  type QuotaLedgerEvent,
  type QuotaSubscriptionIntent,
  type VehicleDocument,
  type VehicleType,
  type LegalStructure,
  type VehicleStage,
  type HurdleType,
  type AdminFeeMode,
} from './quotaEngine';

const LOCAL_INTENTS_KEY = 'auction_quota_intents_v1';

export interface CapitalCall {
  id: string;
  tenant_id: string | null;
  vehicle_id: string;
  title: string;
  description: string | null;
  total_call_brl: number;
  due_date: string;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  created_at: string;
}

export const FALLBACK_REFERENCE_VEHICLES: InvestmentVehicle[] = [
  {
    id: 'ref-scp-flip-sp-01',
    tenant_id: null,
    slug: 'scp-flip-sp-01',
    name: 'Operação Individual #01 · Apartamento Desocupado SP',
    vehicle_type: 'SINGLE_ASSET',
    legal_structure: 'SCP',
    property_id: null,
    property_summary:
      'Modelo Deal-by-Deal (1 imóvel isolado via SCP). Cota nominal de R$ 1.000,00, sem taxa de administração fixa e taxa de performance apenas na venda acima de 100% do CDI.',
    city: 'São Paulo',
    state: 'SP',
    stage: 'CAPTACAO',
    initial_quota_value: 1000,
    current_nav_per_quota: 1000,
    target_capital: 350000,
    raised_capital: 140000,
    total_quotas_issued: 140,
    min_investment_brl: 5000,
    estimated_exit_months: 10,
    projected_roi_pct: 32,
    admin_fee_annual_pct: 0,
    admin_fee_mode: 'ON_EXIT_ACCRUED',
    performance_fee_pct: 20,
    performance_hurdle_type: 'CDI',
    performance_hurdle_annual_pct: 10.75,
    performance_on_exit_only: true,
    active: true,
    is_reference_template: true,
  },
  {
    id: 'ref-clube-multiativo-g2-01',
    tenant_id: null,
    slug: 'clube-multiativo-g2-01',
    name: 'Clube Multi-Imóveis Brasil · Fundo de Arremates',
    vehicle_type: 'MULTI_ASSET_POOL',
    legal_structure: 'SCP',
    property_id: null,
    property_summary:
      'Modelo Pool/Clube diversificado em múltiplos imóveis de leilão (SP/PR/MG). Cota inicial R$ 100,00 valorizada conforme NAV da carteira, taxa de gestão 1,5% a.a. na saída + 20% acima de IPCA+6%.',
    city: 'São Paulo / Curitiba',
    state: 'SP',
    stage: 'REFORMA',
    initial_quota_value: 100,
    current_nav_per_quota: 108.4,
    target_capital: 1000000,
    raised_capital: 433600,
    total_quotas_issued: 4000,
    min_investment_brl: 2500,
    estimated_exit_months: 14,
    projected_roi_pct: 36,
    admin_fee_annual_pct: 1.5,
    admin_fee_mode: 'ON_EXIT_ACCRUED',
    performance_fee_pct: 20,
    performance_hurdle_type: 'IPCA_PLUS_6',
    performance_hurdle_annual_pct: 10.5,
    performance_on_exit_only: true,
    active: true,
    is_reference_template: true,
  },
];

function readLocalIntents(userId?: string): QuotaSubscriptionIntent[] {
  try {
    const raw = localStorage.getItem(LOCAL_INTENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return userId
      ? (parsed as QuotaSubscriptionIntent[]).filter((item) => item.user_id === userId)
      : (parsed as QuotaSubscriptionIntent[]);
  } catch {
    return [];
  }
}

function saveLocalIntents(intents: QuotaSubscriptionIntent[]) {
  try {
    localStorage.setItem(LOCAL_INTENTS_KEY, JSON.stringify(intents));
  } catch {
    // ignore storage quota errors
  }
}

function normalizeVehicle(row: any): InvestmentVehicle {
  return {
    ...row,
    initial_quota_value: Number(row.initial_quota_value || 100),
    current_nav_per_quota: Number(row.current_nav_per_quota || row.initial_quota_value || 100),
    target_capital: Number(row.target_capital || 0),
    raised_capital: Number(row.raised_capital || 0),
    total_quotas_issued: Number(row.total_quotas_issued || 0),
    min_investment_brl: Number(row.min_investment_brl || 1000),
    estimated_exit_months: Number(row.estimated_exit_months || 10),
    projected_roi_pct: Number(row.projected_roi_pct || 28),
    admin_fee_annual_pct: Number(row.admin_fee_annual_pct || 0),
    performance_fee_pct: Number(row.performance_fee_pct || 20),
    performance_hurdle_annual_pct: Number(row.performance_hurdle_annual_pct || 10.75),
  };
}

function isValidUuid(val?: string | null): boolean {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
}

export async function fetchInvestorPortalData(
  userId?: string,
  isDemoSession?: boolean,
  isManager?: boolean
): Promise<{
  vehicles: InvestmentVehicle[];
  ledgerEvents: QuotaLedgerEvent[];
  intents: QuotaSubscriptionIntent[];
  allIntents: QuotaSubscriptionIntent[];
  capitalCalls: CapitalCall[];
  documents: VehicleDocument[];
  syncedFromSupabase: boolean;
}> {
  const localIntents = readLocalIntents(userId);

  if (!supabase) {
    return {
      vehicles: FALLBACK_REFERENCE_VEHICLES,
      ledgerEvents: [],
      intents: localIntents,
      allIntents: localIntents,
      capitalCalls: [],
      documents: [],
      syncedFromSupabase: false,
    };
  }

  try {
    const { data: vData, error: vErr } = await supabase
      .from('investment_vehicles')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: true });

    const vehicles =
      !vErr && Array.isArray(vData) && vData.length > 0
        ? vData.map(normalizeVehicle)
        : FALLBACK_REFERENCE_VEHICLES;

    if (!userId || isDemoSession) {
      return {
        vehicles,
        ledgerEvents: [],
        intents: localIntents,
        allIntents: localIntents,
        capitalCalls: [],
        documents: [],
        syncedFromSupabase: !vErr,
      };
    }

    const intentsQuery = isManager
      ? supabase.from('quota_subscription_intents').select('*').order('created_at', { ascending: false })
      : supabase
          .from('quota_subscription_intents')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

    const [ledgerRes, intentsRes, callsRes, docsRes] = await Promise.all([
      supabase.from('quota_ledger_events').select('*').order('event_date', { ascending: false }),
      intentsQuery,
      supabase.from('capital_calls').select('*').order('due_date', { ascending: true }),
      supabase.from('vehicle_documents').select('*').order('created_at', { ascending: false }),
    ]);

    const ledgerEvents: QuotaLedgerEvent[] = Array.isArray(ledgerRes.data)
      ? ledgerRes.data.map((r: any) => ({
          ...r,
          amount_brl: Number(r.amount_brl || 0),
          quotas_delta: Number(r.quotas_delta || 0),
          quota_price_at_event: Number(r.quota_price_at_event || 0),
        }))
      : [];

    const fetchedIntents: QuotaSubscriptionIntent[] = Array.isArray(intentsRes.data)
      ? intentsRes.data.map((r: any) => ({
          ...r,
          amount_brl: Number(r.amount_brl || 0),
          estimated_quotas: Number(r.estimated_quotas || 0),
          quota_price_snapshot: Number(r.quota_price_snapshot || 0),
        }))
      : localIntents;

    const myIntents = fetchedIntents.filter((it) => it.user_id === userId);

    const capitalCalls: CapitalCall[] = Array.isArray(callsRes.data)
      ? callsRes.data.map((c: any) => ({
          ...c,
          total_call_brl: Number(c.total_call_brl || 0),
        }))
      : [];

    const documents: VehicleDocument[] = Array.isArray(docsRes.data)
      ? (docsRes.data as VehicleDocument[])
      : [];

    return {
      vehicles,
      ledgerEvents,
      intents: myIntents,
      allIntents: fetchedIntents,
      capitalCalls,
      documents,
      syncedFromSupabase: !vErr && !intentsRes.error,
    };
  } catch {
    return {
      vehicles: FALLBACK_REFERENCE_VEHICLES,
      ledgerEvents: [],
      intents: localIntents,
      allIntents: localIntents,
      capitalCalls: [],
      documents: [],
      syncedFromSupabase: false,
    };
  }
}

export async function createQuotaIntent(payload: {
  tenantId?: string | null;
  vehicleId: string;
  userId?: string;
  investorName?: string;
  investorEmail: string;
  amountBrl: number;
  estimatedQuotas: number;
  quotaPriceSnapshot: number;
  notes?: string;
  isDemoSession?: boolean;
}): Promise<{
  ok: boolean;
  intent: QuotaSubscriptionIntent;
  savedToCloud: boolean;
  error?: string;
}> {
  const localRecord: QuotaSubscriptionIntent = {
    id: `local-${Date.now()}`,
    tenant_id: isValidUuid(payload.tenantId) ? (payload.tenantId as string) : null,
    vehicle_id: payload.vehicleId,
    user_id: payload.userId || 'local-investor',
    investor_name: payload.investorName || null,
    investor_email: payload.investorEmail,
    amount_brl: payload.amountBrl,
    estimated_quotas: payload.estimatedQuotas,
    quota_price_snapshot: payload.quotaPriceSnapshot,
    notes: payload.notes?.trim() || null,
    status: 'PENDING',
    created_at: new Date().toISOString(),
  };

  if (supabase && payload.userId && !payload.isDemoSession && isValidUuid(payload.vehicleId)) {
    try {
      const { data, error } = await supabase
        .from('quota_subscription_intents')
        .insert({
          tenant_id: isValidUuid(payload.tenantId) ? payload.tenantId : null,
          vehicle_id: payload.vehicleId,
          user_id: payload.userId,
          investor_name: payload.investorName || null,
          investor_email: payload.investorEmail,
          amount_brl: payload.amountBrl,
          estimated_quotas: payload.estimatedQuotas,
          quota_price_snapshot: payload.quotaPriceSnapshot,
          notes: payload.notes?.trim() || null,
          status: 'PENDING',
        })
        .select('*')
        .single();

      if (!error && data) {
        return {
          ok: true,
          intent: {
            ...data,
            amount_brl: Number(data.amount_brl),
            estimated_quotas: Number(data.estimated_quotas),
            quota_price_snapshot: Number(data.quota_price_snapshot),
          },
          savedToCloud: true,
        };
      }

      const existing = readLocalIntents();
      saveLocalIntents([localRecord, ...existing]);
      return {
        ok: true,
        intent: localRecord,
        savedToCloud: false,
        error: error?.message,
      };
    } catch (err: any) {
      const existing = readLocalIntents();
      saveLocalIntents([localRecord, ...existing]);
      return {
        ok: true,
        intent: localRecord,
        savedToCloud: false,
        error: err?.message,
      };
    }
  }

  const existing = readLocalIntents();
  saveLocalIntents([localRecord, ...existing]);
  return {
    ok: true,
    intent: localRecord,
    savedToCloud: false,
  };
}

export async function cancelQuotaIntent(
  intentId: string,
  userId?: string,
  isDemoSession?: boolean
): Promise<boolean> {
  if (supabase && userId && !isDemoSession && !intentId.startsWith('local-')) {
    try {
      const { error } = await supabase
        .from('quota_subscription_intents')
        .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
        .eq('id', intentId);
      if (!error) return true;
    } catch {
      // fallback local
    }
  }

  const all = readLocalIntents();
  const updated = all.map((it) => (it.id === intentId ? { ...it, status: 'CANCELLED' as const } : it));
  saveLocalIntents(updated);
  return true;
}

export async function createInvestmentVehicle(input: {
  tenantId?: string | null;
  name: string;
  vehicleType: VehicleType;
  legalStructure: LegalStructure;
  propertyId?: string | null;
  propertySummary?: string;
  city?: string;
  state?: string;
  initialQuotaValue: number;
  targetCapital: number;
  minInvestmentBrl: number;
  estimatedExitMonths: number;
  projectedRoiPct: number;
  adminFeeAnnualPct: number;
  adminFeeMode: AdminFeeMode;
  performanceFeePct: number;
  performanceHurdleType: HurdleType;
  performanceHurdleAnnualPct: number;
}): Promise<{ ok: boolean; vehicle?: InvestmentVehicle; error?: string }> {
  if (!supabase) {
    return { ok: false, error: 'Supabase não configurado.' };
  }
  const slugBase = input.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const slug = `${slugBase || 'operacao'}-${Date.now().toString().slice(-5)}`;

  try {
    const { data, error } = await supabase
      .from('investment_vehicles')
      .insert({
        tenant_id: isValidUuid(input.tenantId) ? input.tenantId : null,
        slug,
        name: input.name.trim(),
        vehicle_type: input.vehicleType,
        legal_structure: input.legalStructure,
        property_id: isValidUuid(input.propertyId) ? input.propertyId : null,
        property_summary: input.propertySummary?.trim() || null,
        city: input.city?.trim() || null,
        state: input.state?.trim().toUpperCase().slice(0, 2) || null,
        stage: 'CAPTACAO',
        initial_quota_value: input.initialQuotaValue,
        current_nav_per_quota: input.initialQuotaValue,
        target_capital: input.targetCapital,
        raised_capital: 0,
        total_quotas_issued: 0,
        min_investment_brl: input.minInvestmentBrl,
        estimated_exit_months: input.estimatedExitMonths,
        projected_roi_pct: input.projectedRoiPct,
        admin_fee_annual_pct: input.adminFeeAnnualPct,
        admin_fee_mode: input.adminFeeMode,
        performance_fee_pct: input.performanceFeePct,
        performance_hurdle_type: input.performanceHurdleType,
        performance_hurdle_annual_pct: input.performanceHurdleAnnualPct,
        performance_on_exit_only: true,
        active: true,
        is_reference_template: false,
      })
      .select('*')
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message || 'Erro ao criar operação cotizada.' };
    }
    return { ok: true, vehicle: normalizeVehicle(data) };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Exceção ao criar operação.' };
  }
}

export async function updateInvestmentVehicle(
  vehicleId: string,
  patch: Partial<{
    name: string;
    vehicle_type: VehicleType;
    legal_structure: LegalStructure;
    city: string | null;
    state: string | null;
    property_summary: string | null;
    initial_quota_value: number;
    target_capital: number;
    min_investment_brl: number;
    estimated_exit_months: number;
    projected_roi_pct: number;
    admin_fee_annual_pct: number;
    admin_fee_mode: AdminFeeMode;
    performance_fee_pct: number;
    performance_hurdle_type: HurdleType;
    performance_hurdle_annual_pct: number;
  }>
): Promise<{ ok: boolean; vehicle?: InvestmentVehicle; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase não configurado.' };
  try {
    const cleanPatch: Record<string, any> = {
      ...patch,
      updated_at: new Date().toISOString(),
    };
    if (typeof cleanPatch.state === 'string') {
      cleanPatch.state = cleanPatch.state.trim().toUpperCase().slice(0, 2) || null;
    }
    const { data, error } = await supabase
      .from('investment_vehicles')
      .update(cleanPatch)
      .eq('id', vehicleId)
      .select('*')
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message || 'Falha ao atualizar operação cotizada.' };
    }
    return { ok: true, vehicle: normalizeVehicle(data) };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Exceção ao atualizar operação.' };
  }
}

export async function deleteInvestmentVehicle(
  vehicleId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase não configurado.' };
  try {
    const { error } = await supabase.from('investment_vehicles').delete().eq('id', vehicleId);
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Exceção ao excluir operação.' };
  }
}

export async function convertIntentToQuotas(
  intent: QuotaSubscriptionIntent,
  vehicle: InvestmentVehicle
): Promise<{
  ok: boolean;
  ledgerEvent?: QuotaLedgerEvent;
  updatedVehicle?: InvestmentVehicle;
  error?: string;
}> {
  if (!supabase) return { ok: false, error: 'Supabase não configurado.' };

  const navPrice = Math.max(0.01, vehicle.current_nav_per_quota || vehicle.initial_quota_value);
  const quotasIssued = convertBrlToQuotas(intent.amount_brl, navPrice);

  try {
    const { data: evData, error: evErr } = await supabase
      .from('quota_ledger_events')
      .insert({
        tenant_id: vehicle.tenant_id || null,
        vehicle_id: vehicle.id,
        user_id: intent.user_id,
        event_type: 'SUBSCRIPTION',
        amount_brl: intent.amount_brl,
        quotas_delta: quotasIssued,
        quota_price_at_event: navPrice,
        category: 'INTEGRALIZACAO',
        description: `Integralização de ${quotasIssued.toFixed(4)} cotas (${intent.investor_email})`,
        event_date: new Date().toISOString().slice(0, 10),
      })
      .select('*')
      .single();

    if (evErr || !evData) {
      return { ok: false, error: evErr?.message || 'Falha ao gravar no livro-razão.' };
    }

    await supabase
      .from('quota_subscription_intents')
      .update({
        status: 'CONVERTED',
        estimated_quotas: quotasIssued,
        quota_price_snapshot: navPrice,
        updated_at: new Date().toISOString(),
      })
      .eq('id', intent.id);

    const nextRaised = Number(vehicle.raised_capital || 0) + intent.amount_brl;
    const nextTotalQuotas = Number(vehicle.total_quotas_issued || 0) + quotasIssued;
    const nextStage: VehicleStage =
      vehicle.stage === 'CAPTACAO' && nextRaised >= vehicle.target_capital
        ? 'ARREMATACAO'
        : vehicle.stage;

    const { data: vUpd } = await supabase
      .from('investment_vehicles')
      .update({
        raised_capital: nextRaised,
        total_quotas_issued: nextTotalQuotas,
        stage: nextStage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vehicle.id)
      .select('*')
      .single();

    return {
      ok: true,
      ledgerEvent: {
        ...evData,
        amount_brl: Number(evData.amount_brl),
        quotas_delta: Number(evData.quotas_delta),
        quota_price_at_event: Number(evData.quota_price_at_event),
      },
      updatedVehicle: vUpd ? normalizeVehicle(vUpd) : undefined,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro na conversão em cotas.' };
  }
}

export async function updateVehicleStageAndNav(
  vehicle: InvestmentVehicle,
  nextStage: VehicleStage,
  nextNavPerQuota: number,
  note: string
): Promise<{ ok: boolean; updatedVehicle?: InvestmentVehicle; ledgerEvent?: QuotaLedgerEvent; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase não configurado.' };
  try {
    const { data: vData, error: vErr } = await supabase
      .from('investment_vehicles')
      .update({
        stage: nextStage,
        current_nav_per_quota: nextNavPerQuota,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vehicle.id)
      .select('*')
      .single();

    if (vErr || !vData) {
      return { ok: false, error: vErr?.message || 'Falha ao atualizar operação.' };
    }

    let ledgerEvent: QuotaLedgerEvent | undefined;
    if (nextNavPerQuota !== vehicle.current_nav_per_quota || note.trim()) {
      const { data: evData } = await supabase
        .from('quota_ledger_events')
        .insert({
          tenant_id: vehicle.tenant_id || null,
          vehicle_id: vehicle.id,
          user_id: null,
          event_type: 'VALUATION_MARK',
          amount_brl: nextNavPerQuota * (vehicle.total_quotas_issued || 0),
          quotas_delta: 0,
          quota_price_at_event: nextNavPerQuota,
          category: 'MARCACAO_NAV',
          description:
            note.trim() ||
            `Atualização de etapa (${nextStage}) e cota NAV para R$ ${nextNavPerQuota.toFixed(2)}`,
          event_date: new Date().toISOString().slice(0, 10),
        })
        .select('*')
        .single();
      if (evData) {
        ledgerEvent = {
          ...evData,
          amount_brl: Number(evData.amount_brl),
          quotas_delta: Number(evData.quotas_delta),
          quota_price_at_event: Number(evData.quota_price_at_event),
        };
      }
    }

    return { ok: true, updatedVehicle: normalizeVehicle(vData), ledgerEvent };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro ao atualizar etapa/NAV.' };
  }
}

export async function createCapitalCallOrExpense(params: {
  vehicle: InvestmentVehicle;
  kind: 'CAPITAL_CALL' | 'EXPENSE';
  title: string;
  amountBrl: number;
  dueDate?: string;
  category?: string;
  createdByUserId?: string;
}): Promise<{ ok: boolean; capitalCall?: CapitalCall; ledgerEvent?: QuotaLedgerEvent; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase não configurado.' };

  try {
    if (params.kind === 'CAPITAL_CALL') {
      const { data: callData, error: callErr } = await supabase
        .from('capital_calls')
        .insert({
          tenant_id: params.vehicle.tenant_id || null,
          vehicle_id: params.vehicle.id,
          title: params.title.trim(),
          description: `Chamada de capital rateada entre ${params.vehicle.total_quotas_issued.toFixed(2)} cotas emitidas.`,
          total_call_brl: params.amountBrl,
          due_date: params.dueDate || new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
          status: 'OPEN',
          created_by: params.createdByUserId || null,
        })
        .select('*')
        .single();

      if (callErr || !callData) {
        return { ok: false, error: callErr?.message || 'Erro ao abrir chamada de capital.' };
      }

      return {
        ok: true,
        capitalCall: {
          ...callData,
          total_call_brl: Number(callData.total_call_brl),
        },
      };
    }

    const { data: evData, error: evErr } = await supabase
      .from('quota_ledger_events')
      .insert({
        tenant_id: params.vehicle.tenant_id || null,
        vehicle_id: params.vehicle.id,
        user_id: null,
        event_type: 'EXPENSE',
        amount_brl: -Math.abs(params.amountBrl),
        quotas_delta: 0,
        quota_price_at_event: params.vehicle.current_nav_per_quota,
        category: params.category || 'REFORMA_E_CUSTOS',
        description: params.title.trim(),
        event_date: new Date().toISOString().slice(0, 10),
      })
      .select('*')
      .single();

    if (evErr || !evData) {
      return { ok: false, error: evErr?.message || 'Erro ao registrar despesa.' };
    }

    return {
      ok: true,
      ledgerEvent: {
        ...evData,
        amount_brl: Number(evData.amount_brl),
        quotas_delta: Number(evData.quotas_delta),
        quota_price_at_event: Number(evData.quota_price_at_event),
      },
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Exceção ao registrar evento.' };
  }
}

export async function executeVehicleLiquidation(
  vehicle: InvestmentVehicle,
  grossSaleProceedsBrl: number,
  holdingMonths: number,
  vehicleLedgerEvents: QuotaLedgerEvent[]
): Promise<{ ok: boolean; distributedTotalBrl: number; investorsCount: number; error?: string }> {
  if (!supabase) return { ok: false, distributedTotalBrl: 0, investorsCount: 0, error: 'Supabase não configurado.' };

  const quotasByUser = new Map<string, { quotas: number; invested: number }>();
  for (const ev of vehicleLedgerEvents) {
    if (ev.vehicle_id !== vehicle.id || !ev.user_id) continue;
    const curr = quotasByUser.get(ev.user_id) || { quotas: 0, invested: 0 };
    curr.quotas += ev.quotas_delta || 0;
    if (ev.event_type === 'SUBSCRIPTION' || ev.event_type === 'CAPITAL_CALL') {
      curr.invested += Math.abs(ev.amount_brl);
    }
    quotasByUser.set(ev.user_id, curr);
  }

  const totalQuotas = Array.from(quotasByUser.values()).reduce((acc, v) => acc + Math.max(0, v.quotas), 0);
  const today = new Date().toISOString().slice(0, 10);

  try {
    await supabase.from('quota_ledger_events').insert({
      tenant_id: vehicle.tenant_id || null,
      vehicle_id: vehicle.id,
      user_id: null,
      event_type: 'EXIT_SALE',
      amount_brl: grossSaleProceedsBrl,
      quotas_delta: 0,
      quota_price_at_event: vehicle.current_nav_per_quota,
      category: 'VENDA_EXIT',
      description: `Liquidação do ativo (${vehicle.name}) — Venda bruta de R$ ${grossSaleProceedsBrl.toLocaleString('pt-BR')}`,
      event_date: today,
    });

    let distributedTotalBrl = 0;
    let investorsCount = 0;

    for (const [uid, pos] of quotasByUser.entries()) {
      if (pos.quotas <= 0 || totalQuotas <= 0) continue;
      const sharePct = computeOwnershipPct(pos.quotas, totalQuotas);
      const grossShare = grossSaleProceedsBrl * (sharePct / 100);
      const grossProfit = grossShare - pos.invested;
      const waterfall = computeExitFeeWaterfall({
        investedCapital: pos.invested,
        grossProfitBrl: grossProfit,
        holdingMonths,
        adminFeeAnnualPct: vehicle.admin_fee_annual_pct,
        performanceFeePct: vehicle.performance_fee_pct,
        hurdleType: vehicle.performance_hurdle_type,
        hurdleAnnualPct: vehicle.performance_hurdle_annual_pct,
      });

      await supabase.from('quota_ledger_events').insert({
        tenant_id: vehicle.tenant_id || null,
        vehicle_id: vehicle.id,
        user_id: uid,
        event_type: 'DISTRIBUTION',
        amount_brl: waterfall.netFinalAmountBrl,
        quotas_delta: -pos.quotas,
        quota_price_at_event: waterfall.netFinalAmountBrl / pos.quotas,
        category: 'RESGATE_FINAL',
        description: `Resgate final (${sharePct.toFixed(2)}%): Adm R$ ${waterfall.adminFeeBrl.toFixed(2)} | Perf R$ ${waterfall.performanceFeeBrl.toFixed(2)} | IR R$ ${waterfall.estimatedIrBrl.toFixed(2)}`,
        event_date: today,
      });

      distributedTotalBrl += waterfall.netFinalAmountBrl;
      investorsCount += 1;
    }

    await supabase
      .from('investment_vehicles')
      .update({ stage: 'ENCERRADO', updated_at: new Date().toISOString() })
      .eq('id', vehicle.id);

    return { ok: true, distributedTotalBrl, investorsCount };
  } catch (err: any) {
    return { ok: false, distributedTotalBrl: 0, investorsCount: 0, error: err?.message };
  }
}

export function exportQuotaLedgerCsv(
  events: QuotaLedgerEvent[],
  vehiclesById: Record<string, InvestmentVehicle>,
  investorEmail: string
) {
  const headers = [
    'Data',
    'Operacao',
    'Tipo Evento',
    'Valor (R$)',
    'Variacao Cotas',
    'Valor Cota (R$)',
    'Categoria',
    'Descricao',
    'Investidor',
  ];
  const rows = events.map((ev) => [
    ev.event_date,
    vehiclesById[ev.vehicle_id]?.name || ev.vehicle_id,
    ev.event_type,
    ev.amount_brl.toFixed(2).replace('.', ','),
    ev.quotas_delta.toFixed(6).replace('.', ','),
    ev.quota_price_at_event.toFixed(4).replace('.', ','),
    ev.category || '',
    `"${(ev.description || '').replace(/"/g, '""')}"`,
    investorEmail,
  ]);
  const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `extrato-cotas-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
