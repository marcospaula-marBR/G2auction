import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Briefcase,
  Building2,
  ShieldCheck,
  Edit3,
  Trash2,
  Check,
  X,
  RefreshCw,
  Search,
  PlusCircle,
  CheckCircle2,
  Ban,
} from 'lucide-react';
import {
  fetchAdminStakeholders,
  updateAdminStakeholder,
  removeAdminStakeholderMembership,
  fetchPartnersFromSupabase,
  createPartnerInSupabase,
  updatePartnerInSupabase,
  deletePartnerInSupabase,
  fetchTenantsFromSupabase,
  updateTenantInSupabase,
  deleteTenantInSupabase,
  type AdminStakeholderUser,
  type DbPartnerRecord,
  type DbTenantRecord,
  type StakeholderRole,
  type PartnerCategoryDb,
  type PartnerApprovalDb,
} from '../utils/adminStakeholdersService';

interface AdminStakeholdersPanelProps {
  currentUserId?: string;
  primaryColor: string;
}

type StakeholderTab = 'users' | 'partners' | 'tenants';

const ROLE_META: Record<StakeholderRole, { label: string; cls: string }> = {
  superadmin: { label: 'Superadmin', cls: 'bg-amber-500 text-slate-950' },
  tenant_admin: { label: 'Admin Tenant', cls: 'bg-indigo-600 text-white' },
  partner: { label: 'Parceiro', cls: 'bg-sky-600 text-white' },
  investor: { label: 'Investidor', cls: 'bg-emerald-600 text-white' },
};

const PARTNER_STATUS_META: Record<PartnerApprovalDb, { label: string; cls: string }> = {
  APPROVED: { label: 'Homologado', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  PENDING: { label: 'Pendente', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  SUSPENDED: { label: 'Suspenso', cls: 'bg-red-100 text-red-800 border-red-200' },
};

const PARTNER_CATEGORIES: { value: PartnerCategoryDb; label: string }[] = [
  { value: 'CORRETOR', label: 'Corretor de Imóveis' },
  { value: 'ADVOGADO', label: 'Advogado Especialista' },
  { value: 'ADMINISTRADOR', label: 'Administrador Judicial/Imobiliário' },
  { value: 'DESPACHANTE', label: 'Despachante Imobiliário' },
  { value: 'PEDREIRO_REFORMA', label: 'Pedreiro / Reforma' },
  { value: 'ENGENHEIRO_ARQUITETO', label: 'Engenheiro / Arquiteto' },
  { value: 'AVALIADOR', label: 'Avaliador Imobiliário' },
];

export const AdminStakeholdersPanel: React.FC<AdminStakeholdersPanelProps> = ({
  currentUserId,
  primaryColor,
}) => {
  const [tab, setTab] = useState<StakeholderTab>('users');
  const [loading, setLoading] = useState<boolean>(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [search, setSearch] = useState<string>('');

  // Data
  const [users, setUsers] = useState<AdminStakeholderUser[]>([]);
  const [partners, setPartners] = useState<DbPartnerRecord[]>([]);
  const [tenants, setTenants] = useState<DbTenantRecord[]>([]);

  // Inline edits
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState<string>('');
  const [editUserRole, setEditUserRole] = useState<StakeholderRole>('investor');

  const [editPartnerId, setEditPartnerId] = useState<string | null>(null);
  const [editPartnerForm, setEditPartnerForm] = useState<{
    name: string;
    category: PartnerCategoryDb;
    registration_code: string;
    city: string;
    state: string;
    phone: string;
    email: string;
    pix_key: string;
    specialty: string;
    approval_status: PartnerApprovalDb;
  }>({
    name: '',
    category: 'CORRETOR',
    registration_code: '',
    city: '',
    state: 'SP',
    phone: '',
    email: '',
    pix_key: '',
    specialty: '',
    approval_status: 'APPROVED',
  });

  const [showNewPartner, setShowNewPartner] = useState<boolean>(false);
  const [newPartner, setNewPartner] = useState({
    name: '',
    category: 'CORRETOR' as PartnerCategoryDb,
    registrationCode: '',
    city: '',
    state: 'SP',
    phone: '',
    email: '',
    pixKey: '',
    specialty: '',
    approvalStatus: 'APPROVED' as PartnerApprovalDb,
  });

  const [editTenantId, setEditTenantId] = useState<string | null>(null);
  const [editTenantForm, setEditTenantForm] = useState<{
    brand_name: string;
    support_email: string;
    plan: 'STARTER' | 'PRO' | 'ENTERPRISE';
    platform_fee_pct: number;
    tenant_fee_pct: number;
    active: boolean;
  }>({
    brand_name: '',
    support_email: '',
    plan: 'STARTER',
    platform_fee_pct: 10,
    tenant_fee_pct: 0,
    active: true,
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, pRes, tRes] = await Promise.all([
        fetchAdminStakeholders(),
        fetchPartnersFromSupabase(),
        fetchTenantsFromSupabase(),
      ]);
      if (uRes.ok) setUsers(uRes.users);
      if (pRes.ok) setPartners(pRes.partners);
      if (tRes.ok) setTenants(tRes.tenants);
      if (!uRes.ok && uRes.error) {
        setFeedback({ type: 'error', text: uRes.error });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      `${u.full_name} ${u.email} ${u.member_role}`.toLowerCase().includes(q)
    );
  }, [users, search]);

  const filteredPartners = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter((p) =>
      `${p.name} ${p.category} ${p.city} ${p.state} ${p.email || ''}`.toLowerCase().includes(q)
    );
  }, [partners, search]);

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) =>
      `${t.brand_name} ${t.slug} ${t.support_email || ''}`.toLowerCase().includes(q)
    );
  }, [tenants, search]);

  // Handlers: Users
  const startEditUser = (u: AdminStakeholderUser) => {
    setEditUserId(u.user_id);
    setEditUserName(u.full_name || '');
    setEditUserRole(u.member_role);
  };

  const handleSaveUser = async (userId: string) => {
    setBusyId(userId);
    setFeedback(null);
    try {
      const res = await updateAdminStakeholder(userId, editUserRole, editUserName);
      if (res.ok) {
        setFeedback({ type: 'success', text: 'Stakeholder atualizado com sucesso!' });
        setEditUserId(null);
        await loadAll();
      } else {
        setFeedback({ type: 'error', text: res.error || 'Falha ao atualizar usuário.' });
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleRemoveUser = async (u: AdminStakeholderUser) => {
    if (u.user_id === currentUserId) return;
    const confirmed = window.confirm(
      `Remover vínculo/acesso do stakeholder ${u.email}? O cadastro de parceiro e perfil de alertas também serão revogados.`
    );
    if (!confirmed) return;
    setBusyId(u.user_id);
    setFeedback(null);
    try {
      const res = await removeAdminStakeholderMembership(u.user_id);
      if (res.ok) {
        setFeedback({ type: 'success', text: `Acesso de ${u.email} removido.` });
        await loadAll();
      } else {
        setFeedback({ type: 'error', text: res.error || 'Falha ao remover stakeholder.' });
      }
    } finally {
      setBusyId(null);
    }
  };

  // Handlers: Partners
  const startEditPartner = (p: DbPartnerRecord) => {
    setEditPartnerId(p.id);
    setEditPartnerForm({
      name: p.name,
      category: p.category,
      registration_code: p.registration_code || '',
      city: p.city,
      state: p.state,
      phone: p.phone || '',
      email: p.email || '',
      pix_key: p.pix_key || '',
      specialty: p.specialty || '',
      approval_status: p.approval_status,
    });
  };

  const handleSavePartner = async (partnerId: string) => {
    if (!editPartnerForm.name.trim() || !editPartnerForm.city.trim()) return;
    setBusyId(partnerId);
    setFeedback(null);
    try {
      const res = await updatePartnerInSupabase(partnerId, {
        name: editPartnerForm.name.trim(),
        category: editPartnerForm.category,
        registration_code: editPartnerForm.registration_code.trim() || null,
        city: editPartnerForm.city.trim(),
        state: editPartnerForm.state.trim().toUpperCase().slice(0, 2) || 'SP',
        phone: editPartnerForm.phone.trim() || null,
        email: editPartnerForm.email.trim() || null,
        pix_key: editPartnerForm.pix_key.trim() || null,
        specialty: editPartnerForm.specialty.trim() || null,
        approval_status: editPartnerForm.approval_status,
      });
      if (res.ok) {
        setFeedback({ type: 'success', text: 'Parceiro atualizado no Supabase!' });
        setEditPartnerId(null);
        await loadAll();
      } else {
        setFeedback({ type: 'error', text: res.error || 'Falha ao atualizar parceiro.' });
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleQuickPartnerStatus = async (p: DbPartnerRecord, nextStatus: PartnerApprovalDb) => {
    setBusyId(p.id);
    setFeedback(null);
    try {
      const res = await updatePartnerInSupabase(p.id, { approval_status: nextStatus });
      if (res.ok) {
        setFeedback({
          type: 'success',
          text: `Parceiro ${p.name} alterado para ${PARTNER_STATUS_META[nextStatus].label}.`,
        });
        await loadAll();
      } else {
        setFeedback({ type: 'error', text: res.error || 'Falha ao alterar status.' });
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDeletePartner = async (p: DbPartnerRecord) => {
    const confirmed = window.confirm(`Excluir permanentemente o parceiro "${p.name}"?`);
    if (!confirmed) return;
    setBusyId(p.id);
    setFeedback(null);
    try {
      const res = await deletePartnerInSupabase(p.id);
      if (res.ok) {
        setFeedback({ type: 'success', text: `Parceiro "${p.name}" excluído.` });
        await loadAll();
      } else {
        setFeedback({ type: 'error', text: res.error || 'Falha ao excluir parceiro.' });
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartner.name.trim() || !newPartner.city.trim()) return;
    setBusyId('new-partner');
    setFeedback(null);
    try {
      const res = await createPartnerInSupabase({
        name: newPartner.name,
        category: newPartner.category,
        registrationCode: newPartner.registrationCode,
        city: newPartner.city,
        state: newPartner.state,
        phone: newPartner.phone,
        email: newPartner.email,
        pixKey: newPartner.pixKey,
        specialty: newPartner.specialty,
        approvalStatus: newPartner.approvalStatus,
      });
      if (res.ok) {
        setFeedback({ type: 'success', text: `Parceiro "${newPartner.name}" cadastrado!` });
        setShowNewPartner(false);
        setNewPartner({
          name: '',
          category: 'CORRETOR',
          registrationCode: '',
          city: '',
          state: 'SP',
          phone: '',
          email: '',
          pixKey: '',
          specialty: '',
          approvalStatus: 'APPROVED',
        });
        await loadAll();
      } else {
        setFeedback({ type: 'error', text: res.error || 'Erro ao cadastrar parceiro.' });
      }
    } finally {
      setBusyId(null);
    }
  };

  // Handlers: Tenants
  const startEditTenant = (t: DbTenantRecord) => {
    setEditTenantId(t.id);
    setEditTenantForm({
      brand_name: t.brand_name,
      support_email: t.support_email || '',
      plan: t.plan,
      platform_fee_pct: t.platform_fee_pct,
      tenant_fee_pct: t.tenant_fee_pct,
      active: t.active,
    });
  };

  const handleSaveTenant = async (tId: string) => {
    if (!editTenantForm.brand_name.trim()) return;
    setBusyId(tId);
    setFeedback(null);
    try {
      const res = await updateTenantInSupabase(tId, {
        brand_name: editTenantForm.brand_name.trim(),
        support_email: editTenantForm.support_email.trim() || null,
        plan: editTenantForm.plan,
        platform_fee_pct: editTenantForm.platform_fee_pct,
        tenant_fee_pct: editTenantForm.tenant_fee_pct,
        active: editTenantForm.active,
      });
      if (res.ok) {
        setFeedback({ type: 'success', text: 'Empresa / Tenant atualizado com sucesso!' });
        setEditTenantId(null);
        await loadAll();
      } else {
        setFeedback({ type: 'error', text: res.error || 'Falha ao atualizar tenant.' });
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteTenant = async (t: DbTenantRecord) => {
    const confirmed = window.confirm(
      `Excluir a empresa contratante "${t.brand_name}" (${t.slug})? Todos os registros vinculados podem ser removidos em cascata.`
    );
    if (!confirmed) return;
    setBusyId(t.id);
    setFeedback(null);
    try {
      const res = await deleteTenantInSupabase(t.id, t.slug);
      if (res.ok) {
        setFeedback({ type: 'success', text: `Tenant "${t.brand_name}" excluído.` });
        await loadAll();
      } else {
        setFeedback({ type: 'error', text: res.error || 'Falha ao excluir tenant.' });
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden text-xs">
      <div className="p-5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Superadmin
            </span>
            <span className="text-[11px] text-slate-300 font-bold">
              Controle completo de edição, papéis e exclusão
            </span>
          </div>
          <h3 className="text-base font-black">6. Gestão de Stakeholders (Admin)</h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por nome, e-mail..."
              className="bg-slate-800 border border-slate-700 text-white placeholder:text-slate-400 rounded-xl pl-8 pr-3 py-1.5 text-[11px] font-medium"
            />
          </div>
          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Sub-abas */}
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'users', label: `Usuários & Investidores (${users.length})`, icon: Users },
            { id: 'partners', label: `Parceiros DB (${partners.length})`, icon: Briefcase },
            { id: 'tenants', label: `Empresas / Tenants (${tenants.length})`, icon: Building2 },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as StakeholderTab)}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                  active
                    ? 'text-white shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
                style={active ? { backgroundColor: primaryColor } : undefined}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {tab === 'partners' && (
          <button
            type="button"
            onClick={() => setShowNewPartner((v) => !v)}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{showNewPartner ? 'Fechar Cadastro' : 'Novo Parceiro'}</span>
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`mx-5 mt-4 p-3 rounded-xl border font-bold flex items-center justify-between gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} className="p-0.5 hover:opacity-70">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TAB 1: USUÁRIOS / INVESTIDORES / PAPÉIS */}
      {tab === 'users' && (
        <div className="divide-y divide-slate-100">
          {filteredUsers.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              {loading ? 'Carregando stakeholders...' : 'Nenhum usuário encontrado.'}
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isSelf = u.user_id === currentUserId;
              const isEditing = editUserId === u.user_id;
              const roleMeta = ROLE_META[u.member_role] || ROLE_META.investor;
              return (
                <div key={u.user_id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    {isEditing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl">
                        <input
                          type="text"
                          value={editUserName}
                          onChange={(e) => setEditUserName(e.target.value)}
                          placeholder="Nome completo"
                          className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold"
                        />
                        <select
                          value={editUserRole}
                          onChange={(e) => setEditUserRole(e.target.value as StakeholderRole)}
                          className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold"
                        >
                          <option value="superadmin">Superadmin (Admin Total)</option>
                          <option value="tenant_admin">Admin Tenant</option>
                          <option value="partner">Parceiro</option>
                          <option value="investor">Investidor / Cotista</option>
                        </select>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-slate-900">{u.full_name}</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${roleMeta.cls}`}>
                            {roleMeta.label}
                          </span>
                          {isSelf && (
                            <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                              Você (Admin)
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 block truncate">
                          {u.email} · Reservas: <strong>{u.intents_count}</strong> · Eventos Livro-Razão:{' '}
                          <strong>{u.ledger_events_count}</strong> · Criado em{' '}
                          {new Date(u.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          disabled={busyId === u.user_id}
                          onClick={() => handleSaveUser(u.user_id)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Salvar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditUserId(null)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEditUser(u)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          disabled={isSelf || busyId === u.user_id}
                          onClick={() => handleRemoveUser(u)}
                          title={isSelf ? 'Você não pode remover o próprio acesso admin' : 'Remover acesso do usuário'}
                          className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Excluir Acesso</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: PARCEIROS CADASTRADOS NO SUPABASE */}
      {tab === 'partners' && (
        <div className="divide-y divide-slate-100">
          {showNewPartner && (
            <form onSubmit={handleCreatePartner} className="p-4 bg-emerald-50/40 space-y-3">
              <span className="font-black text-slate-900 block">Cadastrar Novo Parceiro no Supabase</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  required
                  type="text"
                  value={newPartner.name}
                  onChange={(e) => setNewPartner((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nome completo / empresa *"
                  className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold"
                />
                <select
                  value={newPartner.category}
                  onChange={(e) => setNewPartner((p) => ({ ...p, category: e.target.value as PartnerCategoryDb }))}
                  className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold"
                >
                  {PARTNER_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newPartner.registrationCode}
                  onChange={(e) => setNewPartner((p) => ({ ...p, registrationCode: e.target.value }))}
                  placeholder="Registro (OAB / CRECI / CNPJ)"
                  className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5"
                />
                <input
                  required
                  type="text"
                  value={newPartner.city}
                  onChange={(e) => setNewPartner((p) => ({ ...p, city: e.target.value }))}
                  placeholder="Cidade *"
                  className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold"
                />
                <input
                  required
                  type="text"
                  maxLength={2}
                  value={newPartner.state}
                  onChange={(e) => setNewPartner((p) => ({ ...p, state: e.target.value.toUpperCase() }))}
                  placeholder="UF *"
                  className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold uppercase"
                />
                <input
                  type="text"
                  value={newPartner.phone}
                  onChange={(e) => setNewPartner((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="Telefone / WhatsApp"
                  className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5"
                />
                <input
                  type="email"
                  value={newPartner.email}
                  onChange={(e) => setNewPartner((p) => ({ ...p, email: e.target.value }))}
                  placeholder="E-mail"
                  className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5"
                />
                <input
                  type="text"
                  value={newPartner.pixKey}
                  onChange={(e) => setNewPartner((p) => ({ ...p, pixKey: e.target.value }))}
                  placeholder="Chave PIX (Split)"
                  className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5"
                />
                <select
                  value={newPartner.approvalStatus}
                  onChange={(e) =>
                    setNewPartner((p) => ({ ...p, approvalStatus: e.target.value as PartnerApprovalDb }))
                  }
                  className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold"
                >
                  <option value="APPROVED">Homologado</option>
                  <option value="PENDING">Pendente</option>
                  <option value="SUSPENDED">Suspenso</option>
                </select>
              </div>
              <input
                type="text"
                value={newPartner.specialty}
                onChange={(e) => setNewPartner((p) => ({ ...p, specialty: e.target.value }))}
                placeholder="Especialidade / descrição dos serviços"
                className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5"
              />
              <button
                type="submit"
                disabled={busyId === 'new-partner'}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black"
              >
                Salvar Parceiro
              </button>
            </form>
          )}

          {filteredPartners.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              Nenhum parceiro salvo no banco ainda. Você também pode editar/aprovar parceiros diretamente na aba <strong>Parceiros</strong> ou criar um novo acima.
            </div>
          ) : (
            filteredPartners.map((p) => {
              const isEditing = editPartnerId === p.id;
              const stMeta = PARTNER_STATUS_META[p.approval_status] || PARTNER_STATUS_META.PENDING;
              return (
                <div key={p.id} className="p-4 space-y-2">
                  {isEditing ? (
                    <div className="space-y-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={editPartnerForm.name}
                          onChange={(e) => setEditPartnerForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="Nome *"
                          className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold"
                        />
                        <select
                          value={editPartnerForm.category}
                          onChange={(e) =>
                            setEditPartnerForm((f) => ({ ...f, category: e.target.value as PartnerCategoryDb }))
                          }
                          className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold"
                        >
                          {PARTNER_CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={editPartnerForm.approval_status}
                          onChange={(e) =>
                            setEditPartnerForm((f) => ({
                              ...f,
                              approval_status: e.target.value as PartnerApprovalDb,
                            }))
                          }
                          className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold"
                        >
                          <option value="APPROVED">Homologado</option>
                          <option value="PENDING">Pendente</option>
                          <option value="SUSPENDED">Suspenso</option>
                        </select>
                        <input
                          type="text"
                          value={editPartnerForm.city}
                          onChange={(e) => setEditPartnerForm((f) => ({ ...f, city: e.target.value }))}
                          placeholder="Cidade *"
                          className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5"
                        />
                        <input
                          type="text"
                          maxLength={2}
                          value={editPartnerForm.state}
                          onChange={(e) =>
                            setEditPartnerForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))
                          }
                          placeholder="UF"
                          className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 uppercase font-bold"
                        />
                        <input
                          type="text"
                          value={editPartnerForm.registration_code}
                          onChange={(e) =>
                            setEditPartnerForm((f) => ({ ...f, registration_code: e.target.value }))
                          }
                          placeholder="Registro"
                          className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5"
                        />
                        <input
                          type="text"
                          value={editPartnerForm.phone}
                          onChange={(e) => setEditPartnerForm((f) => ({ ...f, phone: e.target.value }))}
                          placeholder="Telefone"
                          className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5"
                        />
                        <input
                          type="email"
                          value={editPartnerForm.email}
                          onChange={(e) => setEditPartnerForm((f) => ({ ...f, email: e.target.value }))}
                          placeholder="E-mail"
                          className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5"
                        />
                        <input
                          type="text"
                          value={editPartnerForm.pix_key}
                          onChange={(e) => setEditPartnerForm((f) => ({ ...f, pix_key: e.target.value }))}
                          placeholder="Chave PIX"
                          className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5"
                        />
                      </div>
                      <input
                        type="text"
                        value={editPartnerForm.specialty}
                        onChange={(e) => setEditPartnerForm((f) => ({ ...f, specialty: e.target.value }))}
                        placeholder="Especialidade"
                        className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => handleSavePartner(p.id)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditPartnerId(null)}
                          className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-700 font-bold"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-slate-900">{p.name}</span>
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                            {p.category}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stMeta.cls}`}>
                            {stMeta.label}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block">
                          {p.city}/{p.state}
                          {p.registration_code ? ` · Reg: ${p.registration_code}` : ''}
                          {p.phone ? ` · ${p.phone}` : ''}
                          {p.pix_key ? ` · PIX: ${p.pix_key}` : ''}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {p.approval_status !== 'APPROVED' ? (
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => handleQuickPartnerStatus(p, 'APPROVED')}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Homologar
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => handleQuickPartnerStatus(p, 'SUSPENDED')}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold flex items-center gap-1"
                          >
                            <Ban className="w-3.5 h-3.5" /> Suspender
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => startEditPartner(p)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => handleDeletePartner(p)}
                          className="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Excluir
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: EMPRESAS CONTRATANTES / WHITE-LABEL TENANTS */}
      {tab === 'tenants' && (
        <div className="divide-y divide-slate-100">
          {filteredTenants.length === 0 ? (
            <div className="p-6 text-center text-slate-500">Nenhuma empresa/tenant encontrada.</div>
          ) : (
            filteredTenants.map((t) => {
              const isCore = t.slug === 'g2' || t.slug === 'whitelabel';
              const isEditing = editTenantId === t.id;
              return (
                <div key={t.id} className="p-4 space-y-2">
                  {isEditing ? (
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={editTenantForm.brand_name}
                          onChange={(e) => setEditTenantForm((f) => ({ ...f, brand_name: e.target.value }))}
                          placeholder="Nome da Marca"
                          className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold"
                        />
                        <input
                          type="email"
                          value={editTenantForm.support_email}
                          onChange={(e) =>
                            setEditTenantForm((f) => ({ ...f, support_email: e.target.value }))
                          }
                          placeholder="E-mail suporte"
                          className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5"
                        />
                        <select
                          value={editTenantForm.plan}
                          onChange={(e) =>
                            setEditTenantForm((f) => ({
                              ...f,
                              plan: e.target.value as 'STARTER' | 'PRO' | 'ENTERPRISE',
                            }))
                          }
                          className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold"
                        >
                          <option value="STARTER">STARTER</option>
                          <option value="PRO">PRO</option>
                          <option value="ENTERPRISE">ENTERPRISE</option>
                        </select>
                        <div>
                          <label className="text-[10px] text-slate-500 block">Fee Plataforma (%)</label>
                          <input
                            type="number"
                            step="0.5"
                            min={0}
                            max={50}
                            value={editTenantForm.platform_fee_pct}
                            onChange={(e) =>
                              setEditTenantForm((f) => ({
                                ...f,
                                platform_fee_pct: Math.max(0, Number(e.target.value) || 0),
                              }))
                            }
                            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block">Fee Licenciado (%)</label>
                          <input
                            type="number"
                            step="0.5"
                            min={0}
                            max={30}
                            value={editTenantForm.tenant_fee_pct}
                            onChange={(e) =>
                              setEditTenantForm((f) => ({
                                ...f,
                                tenant_fee_pct: Math.max(0, Number(e.target.value) || 0),
                              }))
                            }
                            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold"
                          />
                        </div>
                        <label className="flex items-center gap-2 font-bold text-slate-700 pt-4">
                          <input
                            type="checkbox"
                            checked={editTenantForm.active}
                            onChange={(e) => setEditTenantForm((f) => ({ ...f, active: e.target.checked }))}
                          />
                          <span>Ativo</span>
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busyId === t.id}
                          onClick={() => handleSaveTenant(t.id)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditTenantId(null)}
                          className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-700 font-bold"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-slate-900">{t.brand_name}</span>
                          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                            {t.slug}
                          </span>
                          <span className="text-[10px] font-bold bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded-full">
                            {t.plan}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              t.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {t.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block">
                          Fee Plataforma: {t.platform_fee_pct}% · Fee Licenciado: {t.tenant_fee_pct}%
                          {t.support_email ? ` · ${t.support_email}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEditTenant(t)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button
                          type="button"
                          disabled={isCore || busyId === t.id}
                          onClick={() => handleDeleteTenant(t)}
                          title={isCore ? 'Tenant base protegido contra exclusão' : 'Excluir empresa'}
                          className="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Excluir
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
