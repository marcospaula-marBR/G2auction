import { supabase } from '../lib/supabaseClient';
import type {
  InvestmentVehicle,
  QuotaLedgerEvent,
  QuotaSubscriptionIntent,
  VehicleDocument,
} from './quotaEngine';

const LOCAL_INTENTS_KEY = 'auction_quota_intents_v1';

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

export async function fetchInvestorPortalData(
  userId?: string,
  isDemoSession?: boolean
): Promise<{
  vehicles: InvestmentVehicle[];
  ledgerEvents: QuotaLedgerEvent[];
  intents: QuotaSubscriptionIntent[];
  documents: VehicleDocument[];
  syncedFromSupabase: boolean;
}> {
  const localIntents = readLocalIntents(userId);

  if (!supabase) {
    return {
      vehicles: FALLBACK_REFERENCE_VEHICLES,
      ledgerEvents: [],
      intents: localIntents,
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
        documents: [],
        syncedFromSupabase: !vErr,
      };
    }

    const [ledgerRes, intentsRes, docsRes] = await Promise.all([
      supabase
        .from('quota_ledger_events')
        .select('*')
        .order('event_date', { ascending: false }),
      supabase
        .from('quota_subscription_intents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('vehicle_documents')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);

    const ledgerEvents: QuotaLedgerEvent[] = Array.isArray(ledgerRes.data)
      ? ledgerRes.data.map((r: any) => ({
          ...r,
          amount_brl: Number(r.amount_brl || 0),
          quotas_delta: Number(r.quotas_delta || 0),
          quota_price_at_event: Number(r.quota_price_at_event || 0),
        }))
      : [];

    const cloudIntents: QuotaSubscriptionIntent[] = Array.isArray(intentsRes.data)
      ? intentsRes.data.map((r: any) => ({
          ...r,
          amount_brl: Number(r.amount_brl || 0),
          estimated_quotas: Number(r.estimated_quotas || 0),
          quota_price_snapshot: Number(r.quota_price_snapshot || 0),
        }))
      : localIntents;

    const documents: VehicleDocument[] = Array.isArray(docsRes.data)
      ? (docsRes.data as VehicleDocument[])
      : [];

    return {
      vehicles,
      ledgerEvents,
      intents: cloudIntents,
      documents,
      syncedFromSupabase: !vErr && !intentsRes.error,
    };
  } catch {
    return {
      vehicles: FALLBACK_REFERENCE_VEHICLES,
      ledgerEvents: [],
      intents: localIntents,
      documents: [],
      syncedFromSupabase: false,
    };
  }
}

function isValidUuid(val?: string | null): boolean {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
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
        .eq('id', intentId)
        .eq('user_id', userId);
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
