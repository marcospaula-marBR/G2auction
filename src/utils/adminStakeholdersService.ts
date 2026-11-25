import { supabase } from '../lib/supabaseClient';
import type { Partner } from '../types/auction';

export type StakeholderRole = 'superadmin' | 'tenant_admin' | 'partner' | 'investor';
export type PartnerCategoryDb =
  | 'CORRETOR'
  | 'ADVOGADO'
  | 'ADMINISTRADOR'
  | 'DESPACHANTE'
  | 'PEDREIRO_REFORMA'
  | 'ENGENHEIRO_ARQUITETO'
  | 'AVALIADOR';
export type PartnerApprovalDb = 'PENDING' | 'APPROVED' | 'SUSPENDED';

export interface AdminStakeholderUser {
  user_id: string;
  email: string;
  full_name: string;
  account_type: string;
  member_role: StakeholderRole;
  tenant_id: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  intents_count: number;
  ledger_events_count: number;
}

export interface DbPartnerRecord {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  name: string;
  category: PartnerCategoryDb;
  registration_code: string | null;
  city: string;
  state: string;
  phone: string | null;
  email: string | null;
  specialty: string | null;
  trust_score: number;
  rating: number;
  completed_jobs_count: number;
  split_provider: string | null;
  pix_key: string | null;
  approval_status: PartnerApprovalDb;
  created_at: string;
  updated_at: string;
}

export interface DbTenantRecord {
  id: string;
  slug: string;
  custom_domain: string | null;
  brand_name: string;
  tagline: string | null;
  support_email: string | null;
  primary_color: string;
  accent_color: string;
  platform_fee_pct: number;
  tenant_fee_pct: number;
  plan: 'STARTER' | 'PRO' | 'ENTERPRISE';
  active: boolean;
  created_at: string;
}

export function mapPartnerRoleToCategory(role: Partner['role']): PartnerCategoryDb {
  const r = role.toLowerCase();
  if (r.includes('advogado')) return 'ADVOGADO';
  if (r.includes('despachante') && !r.includes('administrador')) return 'DESPACHANTE';
  if (r.includes('administrador')) return 'ADMINISTRADOR';
  if (r.includes('pedreiro') || r.includes('reforma') || r.includes('obra')) return 'PEDREIRO_REFORMA';
  if (r.includes('avaliador')) return 'AVALIADOR';
  if (r.includes('engenheiro') || r.includes('arquiteto')) return 'ENGENHEIRO_ARQUITETO';
  return 'CORRETOR';
}

export function mapCategoryToPartnerRole(category: string): Partner['role'] {
  switch (category) {
    case 'ADVOGADO':
      return 'Advogado Especialista';
    case 'ADMINISTRADOR':
      return 'Administrador / Despachante';
    case 'DESPACHANTE':
      return 'Despachante Imobiliário';
    case 'PEDREIRO_REFORMA':
      return 'Pedreiro / Reforma';
    case 'ENGENHEIRO_ARQUITETO':
      return 'Engenheiro / Arquiteto';
    case 'AVALIADOR':
      return 'Avaliador Imobiliário';
    case 'CORRETOR':
    default:
      return 'Corretor de Imóveis';
  }
}

export function dbPartnerToUiPartner(row: DbPartnerRecord): Partner {
  const approvalStatus: Partner['approvalStatus'] =
    row.approval_status === 'APPROVED'
      ? 'HOMOLOGADO'
      : row.approval_status === 'SUSPENDED'
      ? 'SUSPENSO'
      : 'EM_HOMOLOGACAO';

  return {
    id: row.id,
    name: row.name,
    role: mapCategoryToPartnerRole(row.category),
    city: row.city,
    state: row.state,
    rating: Number(row.rating || 5),
    completedJobsCount: Number(row.completed_jobs_count || 0),
    onTimeRate: 98,
    trustScore: Number(row.trust_score || 85),
    phone: row.phone || '(Não informado)',
    avatar:
      'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80',
    specialty: row.specialty || `Especialista credenciado (${row.category}).`,
    verified: row.approval_status === 'APPROVED',
    registrationCode: row.registration_code || undefined,
    startingPrice: 500,
    responseTimeHours: 4,
    splitReady: Boolean(row.pix_key),
    approvalStatus,
    dbStatus: row.approval_status,
    source: 'supabase',
    email: row.email || undefined,
    pixKey: row.pix_key || undefined,
    services: [
      {
        id: `srv-${row.id}`,
        title: `Consultoria / Serviço (${mapCategoryToPartnerRole(row.category)})`,
        description: row.specialty || 'Atendimento especializado em imóveis de leilão e pós-arrematação.',
        price: 500,
        billingModel: 'Fixo',
        turnaroundDays: 3,
      },
    ],
  };
}

// =====================================================================
// 1. USUÁRIOS / INVESTIDORES / PAPÉIS (RPCs ADMIN)
// =====================================================================
export async function fetchAdminStakeholders(): Promise<{
  ok: boolean;
  users: AdminStakeholderUser[];
  error?: string;
}> {
  if (!supabase) return { ok: false, users: [], error: 'Supabase não configurado.' };
  try {
    const { data, error } = await supabase.rpc('admin_list_stakeholders');
    if (error) {
      return { ok: false, users: [], error: error.message };
    }
    const users: AdminStakeholderUser[] = Array.isArray(data)
      ? data.map((r: any) => ({
          ...r,
          intents_count: Number(r.intents_count || 0),
          ledger_events_count: Number(r.ledger_events_count || 0),
        }))
      : [];
    return { ok: true, users };
  } catch (err: any) {
    return { ok: false, users: [], error: err?.message || 'Erro ao listar usuários.' };
  }
}

export async function updateAdminStakeholder(
  userId: string,
  role: StakeholderRole,
  fullName?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase não configurado.' };
  try {
    const { error } = await supabase.rpc('admin_update_stakeholder', {
      p_user_id: userId,
      p_role: role,
      p_full_name: fullName?.trim() || null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro ao atualizar usuário.' };
  }
}

export async function removeAdminStakeholderMembership(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase não configurado.' };
  try {
    const { error } = await supabase.rpc('admin_remove_stakeholder_membership', {
      p_user_id: userId,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro ao remover acesso do usuário.' };
  }
}

// =====================================================================
// 2. PARCEIROS / ESPECIALISTAS (PUBLIC.PARTNERS)
// =====================================================================
export async function fetchPartnersFromSupabase(): Promise<{
  ok: boolean;
  partners: DbPartnerRecord[];
  error?: string;
}> {
  if (!supabase) return { ok: false, partners: [], error: 'Supabase não configurado.' };
  try {
    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return { ok: false, partners: [], error: error.message };
    const partners: DbPartnerRecord[] = Array.isArray(data)
      ? data.map((r: any) => ({
          ...r,
          trust_score: Number(r.trust_score || 85),
          rating: Number(r.rating || 5),
          completed_jobs_count: Number(r.completed_jobs_count || 0),
        }))
      : [];
    return { ok: true, partners };
  } catch (err: any) {
    return { ok: false, partners: [], error: err?.message || 'Erro ao carregar parceiros.' };
  }
}

export async function createPartnerInSupabase(payload: {
  tenantId?: string | null;
  userId?: string | null;
  name: string;
  category: PartnerCategoryDb;
  registrationCode?: string;
  city: string;
  state: string;
  phone?: string;
  email?: string;
  specialty?: string;
  pixKey?: string;
  approvalStatus?: PartnerApprovalDb;
}): Promise<{ ok: boolean; partner?: DbPartnerRecord; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase não configurado.' };
  const isUuid = Boolean(
    payload.tenantId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.tenantId)
  );
  try {
    const { data, error } = await supabase
      .from('partners')
      .insert({
        tenant_id: isUuid ? payload.tenantId : null,
        user_id: payload.userId || null,
        name: payload.name.trim(),
        category: payload.category,
        registration_code: payload.registrationCode?.trim() || null,
        city: payload.city.trim(),
        state: payload.state.trim().toUpperCase().slice(0, 2) || 'SP',
        phone: payload.phone?.trim() || null,
        email: payload.email?.trim() || null,
        specialty: payload.specialty?.trim() || null,
        pix_key: payload.pixKey?.trim() || null,
        approval_status: payload.approvalStatus || 'PENDING',
      })
      .select('*')
      .single();
    if (error || !data) return { ok: false, error: error?.message || 'Erro ao criar parceiro.' };
    return { ok: true, partner: data as DbPartnerRecord };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Exceção ao criar parceiro.' };
  }
}

export async function updatePartnerInSupabase(
  partnerId: string,
  patch: Partial<{
    name: string;
    category: PartnerCategoryDb;
    registration_code: string | null;
    city: string;
    state: string;
    phone: string | null;
    email: string | null;
    specialty: string | null;
    pix_key: string | null;
    approval_status: PartnerApprovalDb;
    trust_score: number;
  }>
): Promise<{ ok: boolean; partner?: DbPartnerRecord; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase não configurado.' };
  try {
    const cleanPatch: Record<string, any> = {
      ...patch,
      updated_at: new Date().toISOString(),
    };
    if (typeof cleanPatch.state === 'string') {
      cleanPatch.state = cleanPatch.state.trim().toUpperCase().slice(0, 2);
    }
    const { data, error } = await supabase
      .from('partners')
      .update(cleanPatch)
      .eq('id', partnerId)
      .select('*')
      .single();
    if (error || !data) return { ok: false, error: error?.message || 'Erro ao atualizar parceiro.' };
    return { ok: true, partner: data as DbPartnerRecord };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Exceção ao atualizar parceiro.' };
  }
}

export async function deletePartnerInSupabase(
  partnerId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase não configurado.' };
  try {
    const { error } = await supabase.from('partners').delete().eq('id', partnerId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Exceção ao excluir parceiro.' };
  }
}

// =====================================================================
// 3. EMPRESAS CONTRATANTES / WHITE-LABEL TENANTS (PUBLIC.TENANTS)
// =====================================================================
export async function fetchTenantsFromSupabase(): Promise<{
  ok: boolean;
  tenants: DbTenantRecord[];
  error?: string;
}> {
  if (!supabase) return { ok: false, tenants: [], error: 'Supabase não configurado.' };
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, slug, custom_domain, brand_name, tagline, support_email, primary_color, accent_color, platform_fee_pct, tenant_fee_pct, plan, active, created_at')
      .order('created_at', { ascending: true });
    if (error) return { ok: false, tenants: [], error: error.message };
    const tenants: DbTenantRecord[] = Array.isArray(data)
      ? data.map((t: any) => ({
          ...t,
          platform_fee_pct: Number(t.platform_fee_pct || 0),
          tenant_fee_pct: Number(t.tenant_fee_pct || 0),
        }))
      : [];
    return { ok: true, tenants };
  } catch (err: any) {
    return { ok: false, tenants: [], error: err?.message || 'Erro ao carregar empresas/tenants.' };
  }
}

export async function updateTenantInSupabase(
  tenantId: string,
  patch: Partial<{
    brand_name: string;
    tagline: string | null;
    support_email: string | null;
    platform_fee_pct: number;
    tenant_fee_pct: number;
    plan: 'STARTER' | 'PRO' | 'ENTERPRISE';
    active: boolean;
  }>
): Promise<{ ok: boolean; tenant?: DbTenantRecord; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase não configurado.' };
  try {
    const { data, error } = await supabase
      .from('tenants')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', tenantId)
      .select('id, slug, custom_domain, brand_name, tagline, support_email, primary_color, accent_color, platform_fee_pct, tenant_fee_pct, plan, active, created_at')
      .single();
    if (error || !data) return { ok: false, error: error?.message || 'Erro ao atualizar empresa.' };
    return { ok: true, tenant: data as DbTenantRecord };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Exceção ao atualizar empresa.' };
  }
}

export async function deleteTenantInSupabase(
  tenantId: string,
  slug?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase não configurado.' };
  if (slug === 'g2' || slug === 'whitelabel') {
    return { ok: false, error: 'Os tenants base do sistema (g2 / whitelabel) não podem ser excluídos.' };
  }
  try {
    const { error } = await supabase.from('tenants').delete().eq('id', tenantId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Exceção ao excluir tenant.' };
  }
}
