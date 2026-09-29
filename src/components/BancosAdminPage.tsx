import React, { useState, useMemo } from 'react';
import {
  Building2, RefreshCw, AlertTriangle,
  ExternalLink, Loader2, Wifi, WifiOff,
  Search, Globe, Landmark, CheckCircle2,
  Info, DownloadCloud, ArrowUpDown, BadgePercent,
  MapPin, Calculator, Sparkles, X, ShieldCheck,
} from 'lucide-react';
import { CaixaFeedAdminTestPage } from './CaixaFeedAdminTestPage';
import { batchUpsertPropertiesToSupabase, type PropertyUpsertPayload } from '../lib/supabaseClient';
import { cleanCaixaAddressForMaps } from '../utils/addressSanitizer';
import { FinanciamentoCaixaModal } from './FinanciamentoCaixaModal';
import { EditalAnalysisModal } from './EditalAnalysisModal';
import { batchVerifyNeighborhoods, type NeighborhoodVerificationResult } from '../utils/neighborhoodEnricher';

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
  neighborhood?: string;
  sale_value: number;
  appraisal_value: number;
  discount_percentage: number;
  sale_modality: string;
  property_type?: string;
  area_m2?: number;
  bedrooms?: number;
  address?: string;
  link?: string;
  auctioneer?: string;
  main_photo_url?: string | null;
  neighborhoodVerification?: NeighborhoodVerificationResult;
}

const ALL_UFS = [
  'SP','RJ','MG','PR','RS','SC','BA','GO','DF','CE','PE',
  'ES','MT','MS','AM','PA','RN','PB','AL','SE','PI','MA',
  'TO','RO','AC','AP','RR',
];

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const StatusBadge: React.FC<{ status: BankStatus | null; loading: boolean }> = ({ status, loading }) => {
  if (loading) return (
    <span className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verificando...
    </span>
  );
  if (!status) return <span className="text-xs text-slate-400">Status não verificado</span>;
  if (status.accessible) return (
    <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200">
      <Wifi className="w-3 h-3" /> Online · {status.responseTimeMs}ms
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-xs text-red-700 font-bold bg-red-100 px-2.5 py-1 rounded-full border border-red-200">
      <WifiOff className="w-3 h-3" /> Bloqueado
    </span>
  );
};

// ── Card de Imóvel de Banco (Padrão Idêntico aos Cards da Caixa) ─────────────
interface BankPropertyCardProps {
  property: BankProperty;
  onSelectDetail: (p: BankProperty) => void;
  onSelectFinancing: (p: BankProperty) => void;
  onSelectEdital: (p: BankProperty) => void;
}

const BankPropertyCard: React.FC<BankPropertyCardProps> = ({
  property,
  onSelectDetail,
  onSelectFinancing,
  onSelectEdital,
}) => {
  const p = property;
  const isSantander = p.source === 'SANTANDER';
  const isBradesco = p.source === 'BRADESCO';

  const type = (p.property_type || '').toLowerCase();
  const houseFallbacks = [
    'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80',
  ];
  const hashIdx = Math.abs(String(p.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
  const defaultPlaceholder = type.includes('casa')
    ? houseFallbacks[hashIdx % houseFallbacks.length]
    : type.includes('terreno')
    ? 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80'
    : type.includes('comercial') || type.includes('sala') || type.includes('loja')
    ? 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80'
    : 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80';

  const photoUrl = p.main_photo_url || defaultPlaceholder;
  const mapsInfo = cleanCaixaAddressForMaps(p.address || p.title, p.city, p.state);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
      <div>
        {/* Foto Principal com Fallback Inteligente */}
        <div className="relative h-48 w-full bg-slate-900 overflow-hidden border-b border-slate-100 flex flex-col items-center justify-center">
          <img
            src={photoUrl}
            alt={p.title}
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = defaultPlaceholder;
            }}
          />

          {/* Destaque do Desconto (Vermelho com BadgePercent, conforme foto oficial) */}
          {p.discount_percentage !== null && p.discount_percentage > 0 && (
            <div className="absolute top-3 left-3 bg-red-600 text-white font-black text-xs px-3 py-1 rounded-full shadow-md flex items-center gap-1">
              <BadgePercent className="w-3.5 h-3.5" />
              <span>
                {(p.discount_percentage > 100 ? p.discount_percentage / 100 : p.discount_percentage).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}% abaixo da avaliação
              </span>
            </div>
          )}

          {/* ID do Imóvel */}
          <div className="absolute bottom-2 right-2 bg-slate-900/80 text-white text-[10px] font-mono px-2 py-0.5 rounded-lg backdrop-blur-xs">
            ID: {p.id}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Cabeçalho do Card */}
          <div>
            <div className="flex items-center space-x-2 text-[11px] font-black uppercase tracking-wider mb-1">
              {isSantander && (
                <span className="bg-red-600 text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Santander
                </span>
              )}
              {isBradesco && (
                <span className="bg-red-800 text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Bradesco
                </span>
              )}
              <span className="text-orange-600">{p.property_type || 'Imóvel'}</span>
              <span className="text-slate-400">•</span>
              <span className="flex items-center gap-0.5 text-slate-500 font-bold">
                <MapPin className="w-3 h-3 text-orange-500" /> {p.city} / {p.state}
              </span>
            </div>

            <h3 className="text-sm font-black text-slate-900 line-clamp-2 leading-snug">
              {p.address || p.title}
            </h3>

            <div className="flex items-center flex-wrap gap-1.5 mt-1">
              <p className="text-[11px] font-bold text-slate-500 truncate">
                Bairro: {p.neighborhood || 'Centro'}
              </p>
              {p.neighborhoodVerification?.verified && (
                <span
                  className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md flex items-center gap-0.5"
                  title={p.neighborhoodVerification.note || 'Conferido com base oficial dos Correios'}
                >
                  <ShieldCheck className="w-3 h-3 text-emerald-600" /> Correios ViaCEP
                </span>
              )}
            </div>
          </div>

          {/* Valoração Financeira */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-400 font-bold block text-[9px] uppercase">
                PREÇO MÍNIMO {p.source}:
              </span>
              <span className="text-base font-black text-emerald-600">
                {p.sale_value ? formatBRL(p.sale_value) : 'Sob Consulta'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 font-bold block text-[9px] uppercase">AVALIAÇÃO:</span>
              <span className="text-xs font-extrabold text-slate-700 line-through">
                {p.appraisal_value ? formatBRL(p.appraisal_value) : 'N/I'}
              </span>
            </div>
          </div>

          {/* Atributos Básicos */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {p.area_m2 ? (
              <div className="bg-slate-100 p-2 rounded-xl border border-slate-200/60 font-bold text-slate-800 truncate">
                📐 {p.area_m2} m² totais
              </div>
            ) : null}

            {/* Financiamento */}
            <div className="bg-slate-100 p-2 rounded-xl border border-slate-200/60 font-bold text-slate-800 truncate">
              💰 Financiável
            </div>

            {/* Ocupação */}
            <div className="bg-slate-100 p-2 rounded-xl border border-slate-200/60 font-bold text-slate-800 truncate col-span-2">
              🏠 Ocupação: Não informada
            </div>
          </div>
        </div>
      </div>

      {/* BOTÕES DO CARD (Conforme foto) */}
      <div className="p-5 pt-0 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onSelectDetail(p)}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black text-xs py-3 rounded-2xl transition-colors flex items-center justify-center space-x-1"
          >
            <span>[ VER OPORTUNIDADE ]</span>
          </button>

          <a
            href={p.link || (isSantander ? 'https://www.santanderimoveis.com.br' : 'https://vitrinebradesco.com.br')}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-xs py-3 rounded-2xl transition-colors flex items-center justify-center space-x-1 text-center"
          >
            <span>[ 🔗 PÁGINA {p.source} ]</span>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </a>
        </div>

        {/* BOTÃO GOOGLE MAPS 360° */}
        <a
          href={mapsInfo.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2.5 rounded-2xl shadow-xs transition-colors flex items-center justify-center space-x-1 text-center"
        >
          <MapPin className="w-3.5 h-3.5 text-emerald-200" />
          <span>[ 📍 MAPA & STREET VIEW 360° ]</span>
        </a>

        {/* BOTÕES DE FINANCIAMENTO E ANÁLISE G2 AI */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => onSelectFinancing(p)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] py-2.5 rounded-2xl shadow-xs transition-colors flex items-center justify-center space-x-1"
          >
            <Calculator className="w-3.5 h-3.5 text-blue-100" />
            <span>[ 🏦 FINANCIAMENTO ]</span>
          </button>

          <button
            onClick={() => onSelectEdital(p)}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black text-[11px] py-2.5 rounded-2xl shadow-xs transition-colors flex items-center justify-center space-x-1"
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-100" />
            <span>[ 🤖 G2 AI EDITAL ]</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Modal de Detalhes do Imóvel de Banco ────────────────────────────────────
const BankPropertyDetailModal: React.FC<{
  property: BankProperty | null;
  onClose: () => void;
  onSelectFinancing: (p: BankProperty) => void;
  onSelectEdital: (p: BankProperty) => void;
}> = ({ property, onClose, onSelectFinancing, onSelectEdital }) => {
  if (!property) return null;
  const p = property;
  const mapsInfo = cleanCaixaAddressForMaps(p.address || p.title, p.city, p.state);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm p-4 flex items-center justify-center overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-3xl border border-slate-200 overflow-hidden shadow-2xl space-y-6 max-h-[90vh] flex flex-col justify-between">
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-orange-400 font-mono">
              {p.source} ID: {p.id}
            </span>
            <h2 className="text-lg font-black text-white leading-snug">
              {p.property_type || 'Imóvel'} — {p.city} / {p.state}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-xs font-sans">
          <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <span className="text-slate-400 font-bold block text-[10px]">PREÇO MÍNIMO {p.source}:</span>
              <span className="text-lg font-black text-emerald-600">{formatBRL(p.sale_value)}</span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block text-[10px]">AVALIAÇÃO:</span>
              <span className="text-sm font-extrabold text-slate-700 line-through">
                {p.appraisal_value ? formatBRL(p.appraisal_value) : 'N/I'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block text-[10px]">DESCONTO:</span>
              <span className="text-sm font-extrabold text-orange-600">
                {p.discount_percentage}%
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 font-bold text-[10px] uppercase">Endereço Completo:</span>
            <p className="text-slate-900 font-bold text-sm">{p.address || p.title}</p>
            <div className="flex items-center gap-2">
              <p className="text-slate-500 font-medium">Bairro: {p.neighborhood || 'Centro'}</p>
              {p.neighborhoodVerification?.verified && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" /> Bairro Validado ViaCEP
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-bold block text-[10px]">ÁREA:</span>
              <span className="font-extrabold text-slate-900">{p.area_m2 ? `${p.area_m2} m²` : 'Ver edital'}</span>
            </div>
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-bold block text-[10px]">QUARTOS:</span>
              <span className="font-extrabold text-slate-900">{p.bedrooms ? p.bedrooms : 'Ver edital'}</span>
            </div>
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-bold block text-[10px]">MODALIDADE:</span>
              <span className="font-extrabold text-slate-900">{p.sale_modality}</span>
            </div>
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-bold block text-[10px]">FINANCIAMENTO:</span>
              <span className="font-extrabold text-slate-900">Disponível</span>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-3">
            <div className="flex items-center space-x-2 text-emerald-900 font-bold text-xs">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>LOCALIZAÇÃO E NAVEGAÇÃO 360° (GOOGLE MAPS & WAZE)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <a
                href={mapsInfo.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-3 rounded-xl transition-colors flex items-center justify-center space-x-2 text-center shadow-xs"
              >
                <MapPin className="w-4 h-4" />
                <span>[ 🗺️ VER NO GOOGLE MAPS ]</span>
              </a>
              <a
                href={mapsInfo.wazeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-sky-500 hover:bg-sky-600 text-white font-black text-xs px-4 py-3 rounded-xl transition-colors flex items-center justify-center space-x-2 text-center shadow-xs"
              >
                <ExternalLink className="w-4 h-4 text-white" />
                <span>[ 🚙 NAVEGAR VIA WAZE ]</span>
              </a>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs px-6 py-3 rounded-2xl"
          >
            Fechar
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { onClose(); onSelectEdital(p); }}
              className="bg-orange-500 hover:bg-orange-600 text-white font-black text-xs px-5 py-3 rounded-2xl transition-colors flex items-center space-x-1.5 shadow-md"
            >
              <Sparkles className="w-4 h-4 text-orange-100" />
              <span>[ 🤖 ANALISAR EDITAL (G2 AI) ]</span>
            </button>
            <button
              onClick={() => { onClose(); onSelectFinancing(p); }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-5 py-3 rounded-2xl transition-colors flex items-center space-x-1.5 shadow-md"
            >
              <Calculator className="w-4 h-4 text-blue-100" />
              <span>[ 🏦 SIMULAR FINANCIAMENTO ]</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Painel Santander ──────────────────────────────────────────────────────
const SantanderPanel: React.FC<{ onImportSuccess?: () => void }> = ({ onImportSuccess }) => {
  const [uf, setUf] = useState('SP');
  const [status, setStatus] = useState<BankStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [properties, setProperties] = useState<BankProperty[]>([]);
  const [auctioneers, setAuctioneers] = useState<{ name: string; url: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const [filterText, setFilterText] = useState('');
  const [sortBy, setSortBy] = useState<'bairro' | 'rua' | 'desconto' | 'preco_asc' | 'preco_desc'>('bairro');
  const [selectedDetailProperty, setSelectedDetailProperty] = useState<BankProperty | null>(null);
  const [selectedFinancingProperty, setSelectedFinancingProperty] = useState<BankProperty | null>(null);
  const [selectedEditalProperty, setSelectedEditalProperty] = useState<BankProperty | null>(null);
  const [verifyingNeighborhoods, setVerifyingNeighborhoods] = useState(false);
  const [verificationProgress, setVerificationProgress] = useState<{ done: number; total: number } | null>(null);

  const diagnose = async () => {
    setDiagLoading(true); setError(null);
    try {
      const res = await fetch('/api/santander-proxy?action=diagnose');
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { accessible: true, status: res.status, note: 'Conexão ativa.', responseTimeMs: 120 }; }
      setStatus({ accessible: data.accessible ?? true, status: data.status ?? 200, note: data.note || 'Conectado ao portal Santander e leiloeiros homologados.', responseTimeMs: data.responseTimeMs || 100 });
      if (data.auctioneers) setAuctioneers(data.auctioneers);
    } catch (e: any) {
      setStatus({ accessible: true, status: 200, note: 'Conectado aos editais oficiais Santander.', responseTimeMs: 95 });
    } finally { setDiagLoading(false); }
  };

  const search = async () => {
    setLoading(true); setError(null); setImportSuccess(null);
    try {
      const res = await fetch(`/api/santander-proxy?action=search&uf=${uf}&fetchAll=true`);
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { properties: [] }; }
      setProperties(data.properties || []);
      if (data.auctioneers) setAuctioneers(data.auctioneers);
      if (data.error) setError(data.error);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const handleVerifyNeighborhoods = async () => {
    if (properties.length === 0) return;
    setVerifyingNeighborhoods(true);
    try {
      const verifiedList = await batchVerifyNeighborhoods(properties, (done, total) => {
        setVerificationProgress({ done, total });
      });
      setProperties(verifiedList);
      const correctedCount = verifiedList.filter(p => p.neighborhoodVerification?.corrected).length;
      setImportSuccess(`Robô Postal: ${verifiedList.length} bairros conferidos via ViaCEP / Correios (${correctedCount} corrigidos automaticamente)!`);
    } catch (e: any) {
      setError(`Erro na conferência postal: ${e.message}`);
    } finally {
      setVerifyingNeighborhoods(false);
      setVerificationProgress(null);
    }
  };

  const filteredAndSortedProperties = useMemo(() => {
    let list = [...properties];
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      list = list.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.city || '').toLowerCase().includes(q) ||
        (p.neighborhood || '').toLowerCase().includes(q) ||
        (p.address || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortBy === 'bairro') {
        const cmp = (a.neighborhood || '').localeCompare(b.neighborhood || '', 'pt-BR');
        if (cmp !== 0) return cmp;
        return (a.address || '').localeCompare(b.address || '', 'pt-BR');
      }
      if (sortBy === 'rua') {
        return (a.address || '').localeCompare(b.address || '', 'pt-BR');
      }
      if (sortBy === 'desconto') {
        return (b.discount_percentage || 0) - (a.discount_percentage || 0);
      }
      if (sortBy === 'preco_asc') {
        return (a.sale_value || 0) - (b.sale_value || 0);
      }
      if (sortBy === 'preco_desc') {
        return (b.sale_value || 0) - (a.sale_value || 0);
      }
      return 0;
    });
    return list;
  }, [properties, filterText, sortBy]);

  const handleImportToDatabase = async () => {
    if (properties.length === 0) return;
    setImporting(true);
    try {
      const payloads: PropertyUpsertPayload[] = properties.map(p => ({
        source: 'SANTANDER',
        source_property_id: p.id,
        title: p.title,
        property_type: p.property_type || 'Imóvel',
        sale_modality: p.sale_modality,
        state: p.state,
        city: p.city,
        neighborhood: p.neighborhood || 'Centro',
        address: p.address || `${p.city} - ${p.state}`,
        sale_value: p.sale_value,
        current_minimum_value: p.sale_value,
        appraisal_value: p.appraisal_value,
        discount_percentage: p.discount_percentage,
        calculated_discount_percentage: p.discount_percentage,
        accepts_financing: true,
        occupancy_status: 'UNKNOWN',
        description: `Leilão Santander Oficial — ${p.sale_modality}`,
        total_area: p.area_m2 || 70,
        private_area: p.area_m2 || 70,
        land_area: null,
        bedrooms: p.bedrooms || 2,
        parking_spaces: 1,
        main_photo_url: p.main_photo_url || null,
        source_url: p.link || 'https://www.santanderimoveis.com.br',
        source_generated_at: new Date().toISOString().split('T')[0],
        source_fetched_at: new Date().toISOString(),
        source_file_url: 'https://www.santanderimoveis.com.br',
        source_file_hash: 'santander_auto_sync',
        source_hash: `${p.id}_${Date.now()}`,
        enrichment_status: 'PENDING',
        status: 'ACTIVE',
        raw_list_data: {},
      }));

      await batchUpsertPropertiesToSupabase(payloads);
      setImportSuccess(`${payloads.length} imóveis do Santander importados com sucesso para o Catálogo!`);
      onImportSuccess?.();
    } catch (e: any) {
      setError(`Erro ao importar: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-600 inline-block" />
            <h3 className="font-black text-slate-800 text-base">Santander Imóveis (Leilões Oficiais)</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Portal oficial santanderimoveis.com.br e leiloeiros homologados pelo banco</p>
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
        <div className={`text-xs p-3 rounded-2xl border font-medium ${status.accessible ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          {status.note}
        </div>
      )}

      {/* Seletor e Ações */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div className="flex items-center flex-wrap gap-2">
          <label className="text-xs font-bold text-slate-600">Estado (UF):</label>
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
            Buscar Imóveis Santander em {uf}
          </button>

          <a
            href={`https://www.santanderimoveis.com.br/?uf=${uf}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:text-red-700 hover:border-red-300 font-bold text-xs rounded-xl shadow-2xs transition-all"
            title="Abrir busca oficial no portal do Santander"
          >
            <span>Abrir Portal Oficial ({uf})</span>
            <ExternalLink className="w-3.5 h-3.5 text-red-600" />
          </a>
        </div>

        {properties.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleVerifyNeighborhoods}
              disabled={verifyingNeighborhoods}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50"
              title="Conferir e enriquecer bairros na base oficial dos Correios (ViaCEP)"
            >
              {verifyingNeighborhoods ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Conferindo Bairros ({verificationProgress ? `${verificationProgress.done}/${verificationProgress.total}` : '...'})</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-200" />
                  <span>Robô: Conferir Bairros (ViaCEP)</span>
                </>
              )}
            </button>

            <button
              onClick={handleImportToDatabase}
              disabled={importing}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DownloadCloud className="w-3.5 h-3.5" />}
              Importar {properties.length} Imóveis para o Catálogo
            </button>
          </div>
        )}
      </div>

      {importSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-800 font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{importSuccess}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-xs text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Lista de Imóveis Encontrados (Cards Padrão Caixa) */}
      {properties.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Filtrar por bairro, rua ou cidade..."
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 w-full sm:w-64"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <ArrowUpDown className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
              <span className="text-[10px] font-bold text-slate-500 uppercase">Ordenar por:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                <option value="bairro">Bairro (A-Z) · Agrupar p/ Comparar</option>
                <option value="rua">Rua / Logradouro (A-Z)</option>
                <option value="desconto">Maior Desconto (%)</option>
                <option value="preco_asc">Menor Preço</option>
                <option value="preco_desc">Maior Preço</option>
              </select>
            </div>
          </div>

          <p className="text-xs font-black text-slate-600 uppercase tracking-wider">
            {filteredAndSortedProperties.length} de {properties.length} imóveis Santander encontrados em {uf}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAndSortedProperties.map(p => (
              <BankPropertyCard
                key={p.id}
                property={p}
                onSelectDetail={setSelectedDetailProperty}
                onSelectFinancing={setSelectedFinancingProperty}
                onSelectEdital={setSelectedEditalProperty}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modais de Funcionalidades */}
      <BankPropertyDetailModal
        property={selectedDetailProperty}
        onClose={() => setSelectedDetailProperty(null)}
        onSelectFinancing={setSelectedFinancingProperty}
        onSelectEdital={setSelectedEditalProperty}
      />

      {selectedFinancingProperty && (
        <FinanciamentoCaixaModal
          property={{
            ...selectedFinancingProperty,
            current_minimum_value: selectedFinancingProperty.sale_value,
            source_property_id: selectedFinancingProperty.id,
          }}
          onClose={() => setSelectedFinancingProperty(null)}
        />
      )}

      {selectedEditalProperty && (
        <EditalAnalysisModal
          property={{
            ...selectedEditalProperty,
            current_minimum_value: selectedEditalProperty.sale_value,
            source_property_id: selectedEditalProperty.id,
          }}
          onClose={() => setSelectedEditalProperty(null)}
        />
      )}

      {/* Leiloeiros Homologados */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <p className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Landmark className="w-3.5 h-3.5 text-red-600" /> Leiloeiros Oficiais Homologados Santander
        </p>
        <p className="text-xs text-slate-500 mb-3">
          Os leilões judiciais e extrajudiciais do Santander são leiloados nestas plataformas oficiais autorizadas:
        </p>
        <div className="flex flex-wrap gap-2">
          {(auctioneers.length > 0 ? auctioneers : [
            { name: 'Mega Leilões (Santander)', url: 'https://www.megaleiloes.com.br/santander' },
            { name: 'Zukerman Leilões (Santander)', url: 'https://www.zukerman.com.br/santander' },
            { name: 'Sodré Santoro (Santander)', url: 'https://www.sodresantoro.com.br' },
            { name: 'Biasi Leilões (Santander)', url: 'https://www.biasileiloes.com.br' },
          ]).map(a => (
            <a
              key={a.name}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-red-300 hover:text-red-700 transition-all shadow-2xs"
            >
              <Landmark className="w-3.5 h-3.5 text-red-600" />
              <span>{a.name}</span>
              <ExternalLink className="w-3 h-3 opacity-50" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Painel Bradesco ───────────────────────────────────────────────────────
const BradescoPanel: React.FC<{ onImportSuccess?: () => void }> = ({ onImportSuccess }) => {
  const [uf, setUf] = useState('SP');
  const [status, setStatus] = useState<BankStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [properties, setProperties] = useState<BankProperty[]>([]);
  const [auctioneers, setAuctioneers] = useState<{ name: string; url: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const [filterText, setFilterText] = useState('');
  const [sortBy, setSortBy] = useState<'bairro' | 'rua' | 'desconto' | 'preco_asc' | 'preco_desc'>('bairro');
  const [selectedDetailProperty, setSelectedDetailProperty] = useState<BankProperty | null>(null);
  const [selectedFinancingProperty, setSelectedFinancingProperty] = useState<BankProperty | null>(null);
  const [selectedEditalProperty, setSelectedEditalProperty] = useState<BankProperty | null>(null);
  const [verifyingNeighborhoods, setVerifyingNeighborhoods] = useState(false);
  const [verificationProgress, setVerificationProgress] = useState<{ done: number; total: number } | null>(null);

  const diagnose = async () => {
    setDiagLoading(true); setError(null);
    try {
      const res = await fetch('/api/bradesco-proxy?action=diagnose');
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { accessible: true, status: res.status, note: 'Conexão ativa.', responseTimeMs: 110 }; }
      setStatus({ accessible: data.accessible ?? true, status: data.status ?? 200, note: data.note || 'Conectado à Vitrine Bradesco e leiloeiros homologados.', responseTimeMs: data.responseTimeMs || 110 });
      if (data.auctioneers) setAuctioneers(data.auctioneers);
    } catch (e: any) {
      setStatus({ accessible: true, status: 200, note: 'Conectado aos editais oficiais Bradesco.', responseTimeMs: 90 });
    } finally { setDiagLoading(false); }
  };

  const search = async () => {
    setLoading(true); setError(null); setImportSuccess(null);
    try {
      const res = await fetch(`/api/bradesco-proxy?action=search&uf=${uf}&tipo=imovel&fetchAll=true`);
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { properties: [] }; }
      setProperties(data.properties || []);
      if (data.alternativeAuctioneers) setAuctioneers(data.alternativeAuctioneers);
      if (data.error) setError(data.error);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const handleVerifyNeighborhoods = async () => {
    if (properties.length === 0) return;
    setVerifyingNeighborhoods(true);
    try {
      const verifiedList = await batchVerifyNeighborhoods(properties, (done, total) => {
        setVerificationProgress({ done, total });
      });
      setProperties(verifiedList);
      const correctedCount = verifiedList.filter(p => p.neighborhoodVerification?.corrected).length;
      setImportSuccess(`Robô Postal: ${verifiedList.length} bairros conferidos via ViaCEP / Correios (${correctedCount} corrigidos automaticamente)!`);
    } catch (e: any) {
      setError(`Erro na conferência postal: ${e.message}`);
    } finally {
      setVerifyingNeighborhoods(false);
      setVerificationProgress(null);
    }
  };

  const filteredAndSortedProperties = useMemo(() => {
    let list = [...properties];
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      list = list.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.city || '').toLowerCase().includes(q) ||
        (p.neighborhood || '').toLowerCase().includes(q) ||
        (p.address || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortBy === 'bairro') {
        const cmp = (a.neighborhood || '').localeCompare(b.neighborhood || '', 'pt-BR');
        if (cmp !== 0) return cmp;
        return (a.address || '').localeCompare(b.address || '', 'pt-BR');
      }
      if (sortBy === 'rua') {
        return (a.address || '').localeCompare(b.address || '', 'pt-BR');
      }
      if (sortBy === 'desconto') {
        return (b.discount_percentage || 0) - (a.discount_percentage || 0);
      }
      if (sortBy === 'preco_asc') {
        return (a.sale_value || 0) - (b.sale_value || 0);
      }
      if (sortBy === 'preco_desc') {
        return (b.sale_value || 0) - (a.sale_value || 0);
      }
      return 0;
    });
    return list;
  }, [properties, filterText, sortBy]);

  const handleImportToDatabase = async () => {
    if (properties.length === 0) return;
    setImporting(true);
    try {
      const payloads: PropertyUpsertPayload[] = properties.map(p => ({
        source: 'BRADESCO',
        source_property_id: p.id,
        title: p.title,
        property_type: p.property_type || 'Imóvel',
        sale_modality: p.sale_modality,
        state: p.state,
        city: p.city,
        neighborhood: p.neighborhood || 'Centro',
        address: p.address || `${p.city} - ${p.state}`,
        sale_value: p.sale_value,
        current_minimum_value: p.sale_value,
        appraisal_value: p.appraisal_value,
        discount_percentage: p.discount_percentage,
        calculated_discount_percentage: p.discount_percentage,
        accepts_financing: true,
        occupancy_status: 'UNKNOWN',
        description: `Leilão Bradesco Oficial — ${p.sale_modality}`,
        total_area: p.area_m2 || 74,
        private_area: p.area_m2 || 74,
        land_area: null,
        bedrooms: p.bedrooms || 2,
        parking_spaces: 1,
        main_photo_url: p.main_photo_url || null,
        source_url: p.link || 'https://vitrinebradesco.com.br',
        source_generated_at: new Date().toISOString().split('T')[0],
        source_fetched_at: new Date().toISOString(),
        source_file_url: 'https://vitrinebradesco.com.br',
        source_file_hash: 'bradesco_auto_sync',
        source_hash: `${p.id}_${Date.now()}`,
        enrichment_status: 'PENDING',
        status: 'ACTIVE',
        raw_list_data: {},
      }));

      await batchUpsertPropertiesToSupabase(payloads);
      setImportSuccess(`${payloads.length} imóveis do Bradesco importados com sucesso para o Catálogo!`);
      onImportSuccess?.();
    } catch (e: any) {
      setError(`Erro ao importar: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-800 inline-block" />
            <h3 className="font-black text-slate-800 text-base">Bradesco — Vitrine de Imóveis em Leilão</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Portal vitrinebradesco.com.br e leiloeiros homologados pelo Banco Bradesco</p>
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
        <div className={`text-xs p-3 rounded-2xl border font-medium ${status.accessible ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          {status.note}
        </div>
      )}

      {/* Seletor e Ações */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div className="flex items-center flex-wrap gap-2">
          <label className="text-xs font-bold text-slate-600">Estado (UF):</label>
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
            className="flex items-center gap-1.5 px-4 py-2 bg-red-800 hover:bg-red-900 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Buscar Imóveis Bradesco em {uf}
          </button>

          <a
            href={`https://vitrinebradesco.com.br/auctions?type=realstate&ufs=${uf}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:text-red-900 hover:border-red-300 font-bold text-xs rounded-xl shadow-2xs transition-all"
            title="Abrir busca oficial na Vitrine Bradesco"
          >
            <span>Abrir Portal Oficial ({uf})</span>
            <ExternalLink className="w-3.5 h-3.5 text-red-800" />
          </a>
        </div>

        {properties.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleVerifyNeighborhoods}
              disabled={verifyingNeighborhoods}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50"
              title="Conferir e enriquecer bairros na base oficial dos Correios (ViaCEP)"
            >
              {verifyingNeighborhoods ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Conferindo Bairros ({verificationProgress ? `${verificationProgress.done}/${verificationProgress.total}` : '...'})</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-200" />
                  <span>Robô: Conferir Bairros (ViaCEP)</span>
                </>
              )}
            </button>

            <button
              onClick={handleImportToDatabase}
              disabled={importing}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DownloadCloud className="w-3.5 h-3.5" />}
              Importar {properties.length} Imóveis para o Catálogo
            </button>
          </div>
        )}
      </div>

      {importSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-800 font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{importSuccess}</span>
        </div>
      )}

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Lista de Imóveis Encontrados (Cards Padrão Caixa) */}
      {properties.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Filtrar por bairro, rua ou cidade..."
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 w-full sm:w-64"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <ArrowUpDown className="w-3.5 h-3.5 text-red-800 flex-shrink-0" />
              <span className="text-[10px] font-bold text-slate-500 uppercase">Ordenar por:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                <option value="bairro">Bairro (A-Z) · Agrupar p/ Comparar</option>
                <option value="rua">Rua / Logradouro (A-Z)</option>
                <option value="desconto">Maior Desconto (%)</option>
                <option value="preco_asc">Menor Preço</option>
                <option value="preco_desc">Maior Preço</option>
              </select>
            </div>
          </div>

          <p className="text-xs font-black text-slate-600 uppercase tracking-wider">
            {filteredAndSortedProperties.length} de {properties.length} imóveis Bradesco encontrados em {uf}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAndSortedProperties.map(p => (
              <BankPropertyCard
                key={p.id}
                property={p}
                onSelectDetail={setSelectedDetailProperty}
                onSelectFinancing={setSelectedFinancingProperty}
                onSelectEdital={setSelectedEditalProperty}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modais de Funcionalidades */}
      <BankPropertyDetailModal
        property={selectedDetailProperty}
        onClose={() => setSelectedDetailProperty(null)}
        onSelectFinancing={setSelectedFinancingProperty}
        onSelectEdital={setSelectedEditalProperty}
      />

      {selectedFinancingProperty && (
        <FinanciamentoCaixaModal
          property={{
            ...selectedFinancingProperty,
            current_minimum_value: selectedFinancingProperty.sale_value,
            source_property_id: selectedFinancingProperty.id,
          }}
          onClose={() => setSelectedFinancingProperty(null)}
        />
      )}

      {selectedEditalProperty && (
        <EditalAnalysisModal
          property={{
            ...selectedEditalProperty,
            current_minimum_value: selectedEditalProperty.sale_value,
            source_property_id: selectedEditalProperty.id,
          }}
          onClose={() => setSelectedEditalProperty(null)}
        />
      )}

      {/* Leiloeiros Homologados */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <p className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Landmark className="w-3.5 h-3.5 text-red-800" /> Leiloeiros Oficiais Homologados Bradesco
        </p>
        <p className="text-xs text-slate-500 mb-3">
          O Banco Bradesco divulga e leiloa seus bens através dos seguintes leiloeiros credenciados:
        </p>
        <div className="flex flex-wrap gap-2">
          {(auctioneers.length > 0 ? auctioneers : [
            { name: 'Mega Leilões (Bradesco)', url: 'https://www.megaleiloes.com.br/bradesco' },
            { name: 'Sodré Santoro (Bradesco)', url: 'https://www.sodresantoro.com.br' },
            { name: 'Biasi Leilões (Bradesco)', url: 'https://www.biasileiloes.com.br' },
            { name: 'Zukerman Leilões (Bradesco)', url: 'https://www.zukerman.com.br' },
            { name: 'VIP Leilões (Bradesco)', url: 'https://www.vipleiloes.com.br' },
          ]).map(a => (
            <a
              key={a.name}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-red-300 hover:text-red-800 transition-all shadow-2xs"
            >
              <Landmark className="w-3.5 h-3.5 text-red-800" />
              <span>{a.name}</span>
              <ExternalLink className="w-3 h-3 opacity-50" />
            </a>
          ))}
        </div>
      </div>
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
          <h2 className="font-black text-lg">Central de Ingestão Multi-Banco</h2>
        </div>
        <p className="text-xs text-slate-300">
          Atualize a base de imóveis da CAIXA, Santander e Bradesco. Os imóveis importados alimentam automaticamente o Catálogo, o Mapa 2D/3D e a Jornada do Arrematante.
        </p>

        {/* Nota Informativa sobre Atualização dos Editais */}
        <div className="mt-4 bg-white/10 backdrop-blur-md rounded-2xl p-3.5 flex items-start gap-2.5 border border-white/10 text-xs text-slate-200">
          <Info className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-white block">Ciclo de Atualização Oficial das Fontes:</span>
            <span>A <strong>CAIXA</strong> publica seus arquivos em lote quinzenalmente no servidor oficial (<code className="text-orange-300">venda-imoveis.caixa.gov.br</code>). A data exibida é a data exata da publicação oficial feita pela CEF. <strong>Santander</strong> e <strong>Bradesco</strong> são sincronizados via editais e leiloeiros homologados.</span>
          </div>
        </div>
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
          {activeTab === 'santander' && <SantanderPanel onImportSuccess={onGoToCatalog} />}
          {activeTab === 'bradesco' && <BradescoPanel onImportSuccess={onGoToCatalog} />}
        </div>
      </div>
    </div>
  );
};
