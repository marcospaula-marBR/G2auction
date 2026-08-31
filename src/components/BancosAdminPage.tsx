import React, { useState } from 'react';
import {
  Building2, RefreshCw, AlertTriangle,
  ExternalLink, Loader2, Wifi, WifiOff,
  Search, Globe, Landmark,
} from 'lucide-react';
import { CaixaFeedAdminTestPage } from './CaixaFeedAdminTestPage';

// ── Tipos compartilhados ──────────────────────────────────────────────────
interface BankStatus {
  accessible: boolean | null;
  status: number | null;
  note: string;
  responseTimeMs: number | null;
}

interface BankProperty {
  source: string;
  id: string;
  title: string;
  city: string;
  state: string;
  sale_value: number;
  appraisal_value: number;
  discount_percentage: number;
  sale_modality: string;
  link?: string;
  auctioneer?: string;
}

const ALL_UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
];

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

// ── Sub-componentes ───────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: BankStatus | null; loading: boolean }> = ({ status, loading }) => {
  if (loading) return (
    <span className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verificando...
    </span>
  );
  if (!status) return <span className="text-xs text-slate-400">Não verificado</span>;
  if (status.accessible) return (
    <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
      <Wifi className="w-3 h-3" /> Online · {status.responseTimeMs}ms
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-xs text-red-700 font-bold bg-red-100 px-2 py-0.5 rounded-full border border-red-200">
      <WifiOff className="w-3 h-3" /> Bloqueado
    </span>
  );
};

// ── Painel Santander ──────────────────────────────────────────────────────
const SantanderPanel: React.FC = () => {
  const [uf, setUf] = useState('SP');
  const [status, setStatus] = useState<BankStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [properties, setProperties] = useState<BankProperty[]>([]);
  const [error, setError] = useState<string | null>(null);

  const diagnose = async () => {
    setDiagLoading(true); setError(null);
    try {
      const r = await fetch('/api/santander-proxy?action=diagnose');
      const data = await r.json();
      setStatus({ accessible: data.accessible, status: data.status, note: data.note, responseTimeMs: data.responseTimeMs });
    } catch (e: any) {
      setError(e.message);
    } finally { setDiagLoading(false); }
  };

  const search = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/santander-proxy?action=search&uf=${uf}`);
      const data = await r.json();
      setProperties(data.properties || []);
      if (data.error) setError(data.error);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-black text-slate-800">Santander Imóveis</h3>
          <p className="text-xs text-slate-500">Portal: santanderimoveis.com.br · Scraping HTML público</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} loading={diagLoading} />
          <button
            onClick={diagnose}
            disabled={diagLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 font-bold text-xs rounded-xl hover:bg-red-100 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${diagLoading ? 'animate-spin' : ''}`} />
            Diagnosticar
          </button>
        </div>
      </div>

      {status && (
        <div className={`text-xs px-3 py-2 rounded-xl border font-medium ${status.accessible ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
          {status.note}
        </div>
      )}

      <div className="flex items-center gap-2">
        <select
          value={uf}
          onChange={e => setUf(e.target.value)}
          className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-300"
        >
          {ALL_UFS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <button
          onClick={search}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          Buscar Imóveis {uf}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {properties.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-black text-slate-600 uppercase tracking-wider">{properties.length} imóveis encontrados</p>
          {properties.map(p => (
            <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-3">
              <div className="flex-1">
                <p className="font-bold text-sm text-slate-800 truncate">{p.title}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-emerald-700 font-bold">{formatBRL(p.sale_value)}</span>
                  <span className="text-xs text-slate-500">{p.sale_modality}</span>
                  <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-bold">{p.discount_percentage}% desc</span>
                </div>
              </div>
              {p.link && (
                <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-red-600 transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && properties.length === 0 && status !== null && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
          <Globe className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-500">Portal pode ser SPA (JavaScript)</p>
          <p className="text-xs text-slate-400 mt-1">O Santander Imóveis usa renderização client-side.<br />Acesse diretamente: <a href="https://www.santanderimoveis.com.br" target="_blank" rel="noopener noreferrer" className="text-red-600 underline">santanderimoveis.com.br</a></p>
        </div>
      )}
    </div>
  );
};

// ── Painel Bradesco ───────────────────────────────────────────────────────
const BradescoPanel: React.FC = () => {
  const [uf, setUf] = useState('SP');
  const [status, setStatus] = useState<BankStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [properties, setProperties] = useState<BankProperty[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [altAuctioneers, setAltAuctioneers] = useState<{name: string; url: string}[]>([]);

  const diagnose = async () => {
    setDiagLoading(true); setError(null);
    try {
      const r = await fetch('/api/bradesco-proxy?action=diagnose');
      const data = await r.json();
      const firstTest = data.tests?.[0];
      setStatus({
        accessible: data.accessible,
        status: firstTest?.status ?? null,
        note: data.note || '',
        responseTimeMs: data.responseTimeMs,
      });
    } catch (e: any) {
      setError(e.message);
    } finally { setDiagLoading(false); }
  };

  const search = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/bradesco-proxy?action=search&uf=${uf}&tipo=imovel`);
      const data = await r.json();
      setProperties(data.properties || []);
      setAltAuctioneers(data.alternativeAuctioneers || []);
      if (data.note) setError(data.note);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-black text-slate-800">Bradesco — Vitrine de Imóveis</h3>
          <p className="text-xs text-slate-500">Portal: vitrinebradesco.com.br · Scraping HTML público</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} loading={diagLoading} />
          <button
            onClick={diagnose}
            disabled={diagLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 font-bold text-xs rounded-xl hover:bg-red-100 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${diagLoading ? 'animate-spin' : ''}`} />
            Diagnosticar
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={uf}
          onChange={e => setUf(e.target.value)}
          className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
        >
          {ALL_UFS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <button
          onClick={search}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          Buscar Imóveis {uf}
        </button>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {properties.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-black text-slate-600 uppercase tracking-wider">{properties.length} imóveis encontrados</p>
          {properties.map(p => (
            <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-3">
              <div className="flex-1">
                <p className="font-bold text-sm text-slate-800 truncate">{p.title}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-emerald-700 font-bold">{formatBRL(p.sale_value)}</span>
                  <span className="text-xs text-slate-500">{p.auctioneer || p.sale_modality}</span>
                  <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-bold">{p.discount_percentage}% desc</span>
                </div>
              </div>
              {p.link && (
                <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-red-700 transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Leiloeiros parceiros */}
      {altAuctioneers.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <p className="text-xs font-black text-slate-600 uppercase tracking-wider mb-2">🏛️ Leiloeiros Parceiros Bradesco</p>
          <div className="flex flex-wrap gap-2">
            {altAuctioneers.map(a => (
              <a
                key={a.name}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-red-300 hover:text-red-700 transition-all"
              >
                <Landmark className="w-3.5 h-3.5" /> {a.name} <ExternalLink className="w-3 h-3 opacity-50" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────────────────
type BankTab = 'caixa' | 'santander' | 'bradesco';

interface BancosAdminPageProps {
  onGoToCatalog?: () => void;
}

export const BancosAdminPage: React.FC<BancosAdminPageProps> = ({ onGoToCatalog }) => {
  const [activeTab, setActiveTab] = useState<BankTab>('caixa');

  const TABS: { id: BankTab; label: string; icon: React.ElementType; color: string; activeColor: string }[] = [
    { id: 'caixa', label: 'CAIXA Econômica', icon: Building2, color: 'text-sky-700', activeColor: 'bg-sky-600' },
    { id: 'santander', label: 'Santander', icon: Globe, activeColor: 'bg-red-600', color: 'text-red-700' },
    { id: 'bradesco', label: 'Bradesco', icon: Landmark, activeColor: 'bg-red-800', color: 'text-red-900' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-6 text-white">
        <div className="flex items-center gap-3 mb-1">
          <RefreshCw className="w-5 h-5 text-orange-400" />
          <h2 className="font-black text-lg">Importação Multi-Banco</h2>
        </div>
        <p className="text-xs text-slate-300">
          Atualize a base de imóveis da CAIXA, Santander e Bradesco. Cada banco usa a melhor estratégia disponível de ingestão de dados.
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-xs font-black transition-all ${
                  isActive
                    ? `${tab.activeColor} text-white`
                    : `text-slate-600 hover:bg-slate-50 ${tab.color}`
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.id.toUpperCase()}</span>
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {activeTab === 'caixa' && (
            <CaixaFeedAdminTestPage onGoToCatalog={onGoToCatalog} />
          )}
          {activeTab === 'santander' && <SantanderPanel />}
          {activeTab === 'bradesco' && <BradescoPanel />}
        </div>
      </div>
    </div>
  );
};
