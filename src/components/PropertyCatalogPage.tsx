import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Building2,
  MapPin,
  BadgePercent,
  ArrowUpDown,
  X,
  Sparkles,
  Calculator,
  CreditCard,
  AlertCircle,
  Route,
  Map as MapIcon,
  LayoutGrid,
  Columns2,
} from 'lucide-react';

import {
  queryPropertiesFromSupabase,
  fetchDistinctStatesFromSupabase,
  fetchDistinctCitiesByStateFromSupabase,
  fetchDistinctPropertyTypesFromSupabase,
  fetchDistinctSaleModalitiesFromSupabase,
  fetchCatalogSummaryStatsFromSupabase,
  fetchBankFreshnessFromSupabase,
  type BankFreshnessInfo,
  type PropertyFilterParams,
} from '../lib/supabaseClient';

import type { Property } from '../types/auction';
import { adaptCatalogItemToProperty } from '../utils/propertyAdapter';
import { formatCurrencyBRL } from '../utils/financial';
import { cleanCaixaAddressForMaps } from '../utils/addressSanitizer';
import { getCaixaPropertyPageUrl } from '../utils/caixaEditalHelper';
import { extractHdnImovelFromUrl } from '../utils/caixaListImporter';
import { getAuctionValues, getPaymentConditions, formatStandardPropertyId, extractCleanPropertyAddress } from '../utils/propertyAuctionHelper';
import { EditalAnalysisModal } from './EditalAnalysisModal';
import { FinanciamentoCaixaModal } from './FinanciamentoCaixaModal';
import { BancosAdminPage } from './BancosAdminPage';
import { PropertyMap } from './PropertyMap';
import { useTenant } from '../config/tenant';

interface PropertyCatalogPageProps {
  onOpenAdmin?: () => void;
  onOpenJourney?: (property: any) => void;
  onPropertiesLoaded?: (adapted: Property[]) => void;
  onOpenMaxBid?: (property: Property) => void;
  onOpenDetail360?: (property: Property) => void;
}

export const PropertyCatalogPage: React.FC<PropertyCatalogPageProps> = ({
  onOpenAdmin: _onOpenAdmin,
  onOpenJourney,
  onPropertiesLoaded,
  onOpenMaxBid: _onOpenMaxBid,
  onOpenDetail360,
}) => {
  const { tenant } = useTenant();
  const [activeTab, setActiveTab] = useState<'catalog' | 'sync'>('catalog');
  const [viewMode, setViewMode] = useState<'grid' | 'split' | 'map'>('grid');
  const [activeMapLayer, setActiveMapLayer] = useState<'default' | 'price' | 'flood' | 'safety' | 'noise' | '3d'>('default');
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState<boolean>(false);
  // Estatísticas Resumidas da Base e Frescor por Banco
  const [summaryStats, setSummaryStats] = useState<{
    totalActiveCount: number;
    lastImportDate: string | null;
    lastImportGeneratedAt: string | null;
  }>({
    totalActiveCount: 0,
    lastImportDate: null,
    lastImportGeneratedAt: null,
  });
  const [bankFreshness, setBankFreshness] = useState<BankFreshnessInfo[]>([]);

  // Opções Dinâmicas para os Selects (Seções 19, 20, 27, 28)
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [availableModalities, setAvailableModalities] = useState<string[]>([]);

  // Estados dos Filtros (Seção 18 a 30)
  const [selectedState, setSelectedState] = useState<string>('SP');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedBank, setSelectedBank] = useState<string>('ALL');
  const [priceMinInput, setPriceMinInput] = useState<string>('');
  const [priceMaxInput, setPriceMaxInput] = useState<string>('');
  const [appraisalMinInput, setAppraisalMinInput] = useState<string>('');
  const [appraisalMaxInput, setAppraisalMaxInput] = useState<string>('');
  const [discountMin, setDiscountMin] = useState<number | undefined>(undefined);
  const [financing, setFinancing] = useState<boolean | null>(null);
  const [occupancy, setOccupancy] = useState<'OCCUPIED' | 'VACANT' | 'UNKNOWN' | null>(null);
  const [areaType, setAreaType] = useState<'private_area' | 'total_area' | 'land_area'>('private_area');
  const [areaMinInput, setAreaMinInput] = useState<string>('');
  const [areaMaxInput, setAreaMaxInput] = useState<string>('');
  const [propertyType, setPropertyType] = useState<string>('Todos');
  const [saleModality, setSaleModality] = useState<string>('Todas');

  // Ordenação e Paginação (Seção 32 & 33)
  const [sortBy, setSortBy] = useState<
    'discount_desc' | 'price_asc' | 'appraisal_desc' | 'area_desc' | 'recent_desc' | 'neighborhood_asc' | 'address_asc'
  >('discount_desc');
  const [page, setPage] = useState<number>(1);
  const pageSize = 24;

  // Estados de Dados do Catálogo
  const [properties, setProperties] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [isMemoryFallback, setIsMemoryFallback] = useState<boolean>(false);

  // Modal de Detalhes do Imóvel (Seção 38)
  const [selectedDetailProperty, setSelectedDetailProperty] = useState<any | null>(null);

  // Modal de Análise de Edital via G2 AI
  const [selectedEditalProperty, setSelectedEditalProperty] = useState<any | null>(null);

  // Modal do Simulador de Financiamento CAIXA
  const [selectedFinancingProperty, setSelectedFinancingProperty] = useState<any | null>(null);

  // Carregar estatísticas e opções dos selects no primeiro render
  useEffect(() => {
    async function loadInitialOptions() {
      const [statsRes, freshnessRes] = await Promise.all([
        fetchCatalogSummaryStatsFromSupabase(),
        fetchBankFreshnessFromSupabase(),
      ]);
      setSummaryStats(statsRes);
      setBankFreshness(freshnessRes);

      const states = await fetchDistinctStatesFromSupabase();
      setAvailableStates(states);
      if (states.length > 0 && !states.includes('SP')) {
        setSelectedState(states[0]);
      }

      const types = await fetchDistinctPropertyTypesFromSupabase();
      setAvailableTypes(types);

      const mods = await fetchDistinctSaleModalitiesFromSupabase();
      setAvailableModalities(mods);
    }
    loadInitialOptions();
  }, []);

  // Carregar cidades dependentes sempre que o estado selecionado mudar (Seção 20)
  useEffect(() => {
    async function loadCities() {
      if (selectedState) {
        const cities = await fetchDistinctCitiesByStateFromSupabase(selectedState);
        setAvailableCities(cities);
        setSelectedCity(''); // Limpar cidade ao trocar de estado (Seção 20)
      } else {
        setAvailableCities([]);
        setSelectedCity('');
      }
    }
    loadCities();
  }, [selectedState]);

  // Função principal de busca ao Supabase
  const executeSearch = useCallback(async (targetPage: number = 1) => {
    setLoading(true);
    setPage(targetPage);

    try {
      const params: PropertyFilterParams = {
        state: selectedState || undefined,
        city: selectedCity || undefined,
        source: selectedBank !== 'ALL' ? selectedBank : undefined,
        priceMin: priceMinInput ? Number(priceMinInput) : undefined,
        priceMax: priceMaxInput ? Number(priceMaxInput) : undefined,
        appraisalMin: appraisalMinInput ? Number(appraisalMinInput) : undefined,
        appraisalMax: appraisalMaxInput ? Number(appraisalMaxInput) : undefined,
        discountMin: discountMin !== undefined ? discountMin : undefined,
        financing: financing,
        occupancy: occupancy,
        areaType: areaType,
        areaMin: areaMinInput ? Number(areaMinInput) : undefined,
        areaMax: areaMaxInput ? Number(areaMaxInput) : undefined,
        propertyType: propertyType !== 'Todos' ? propertyType : undefined,
        saleModality: saleModality !== 'Todas' ? saleModality : undefined,
        sortBy: sortBy,
        page: targetPage,
        pageSize: pageSize,
      };

      const res = await queryPropertiesFromSupabase(params);

      const loaded = res?.data || [];
      setProperties(loaded);
      setTotalCount(res?.totalCount || 0);
      setTotalPages(res?.totalPages || 1);
      setIsMemoryFallback(Boolean(res?.isMemoryFallback));

      if (onPropertiesLoaded && loaded.length > 0) {
        onPropertiesLoaded(loaded.map((item: any, idx: number) => adaptCatalogItemToProperty(item, idx)));
      }
    } catch (err) {
      console.error('[executeSearch Error]', err);
    } finally {
      setLoading(false);
    }
  }, [
    selectedState,
    selectedCity,
    selectedBank,
    priceMinInput,
    priceMaxInput,
    appraisalMinInput,
    appraisalMaxInput,
    discountMin,
    financing,
    occupancy,
    areaType,
    areaMinInput,
    areaMaxInput,
    propertyType,
    saleModality,
    sortBy,
    pageSize,
  ]);

  // Volta para o catálogo se adminSync for desabilitado
  useEffect(() => {
    if (!tenant.features.adminSync && activeTab === 'sync') {
      setActiveTab('catalog');
    }
  }, [tenant.features.adminSync, activeTab]);

  // Se mapa for desabilitado no tenant, força modo grid
  useEffect(() => {
    if (!tenant.features.map && viewMode !== 'grid') {
      setViewMode('grid');
    }
  }, [tenant.features.map, viewMode]);

  const adaptedPropertiesForMap = useMemo(
    () => properties.map((item, idx) => adaptCatalogItemToProperty(item, idx)),
    [properties]
  );

  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (propertyType !== 'Todos') count++;
    if (saleModality !== 'Todas') count++;
    if (priceMinInput) count++;
    if (appraisalMinInput || appraisalMaxInput) count++;
    if (financing !== null) count++;
    if (occupancy !== null) count++;
    if (areaMinInput || areaMaxInput) count++;
    return count;
  }, [propertyType, saleModality, priceMinInput, appraisalMinInput, appraisalMaxInput, financing, occupancy, areaMinInput, areaMaxInput]);

  // Executar busca inicial e quando mudar a ordenação ou banco
  useEffect(() => {
    executeSearch(1);
  }, [sortBy, selectedBank, executeSearch]);

  const handleClearFilters = () => {
    setSelectedState('SP');
    setSelectedCity('');
    setSelectedBank('ALL');
    setPriceMinInput('');
    setPriceMaxInput('');
    setAppraisalMinInput('');
    setAppraisalMaxInput('');
    setDiscountMin(undefined);
    setFinancing(null);
    setOccupancy(null);
    setAreaType('private_area');
    setAreaMinInput('');
    setAreaMaxInput('');
    setPropertyType('Todos');
    setSaleModality('Todas');
    setPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5 font-sans">
      
      {/* BARRA SUPERIOR DO CATÁLOGO */}
      <div
        className="relative overflow-hidden bg-white/95 backdrop-blur-md text-slate-800 p-5 sm:p-6 rounded-3xl border shadow-sm space-y-4 transition-colors"
        style={{
          backgroundImage: `linear-gradient(135deg, ${tenant.primaryColor}12 0%, rgba(255,255,255,0.92) 48%, ${tenant.accentColor}12 100%)`,
          borderColor: `${tenant.primaryColor}26`,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <span
              className="text-white font-black text-[11px] px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-xs"
              style={{ backgroundColor: tenant.primaryColor }}
            >
              <Sparkles className="w-3.5 h-3.5" /> Oportunidades
            </span>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/90 text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Base Multi-Bancos
            </span>
          </div>

          {/* SELETOR DE MODO ADMIN: Apenas quando habilitado no tenant/admin */}
          {tenant.features.adminSync && (
            <div className="flex items-center bg-slate-100/90 backdrop-blur-sm p-1 rounded-2xl border border-slate-200/80">
              <button
                onClick={() => setActiveTab('catalog')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'catalog'
                    ? 'text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                style={activeTab === 'catalog' ? { backgroundColor: tenant.primaryColor } : undefined}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Catálogo</span>
              </button>
              <button
                onClick={() => setActiveTab('sync')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'sync'
                    ? 'text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                style={activeTab === 'sync' ? { backgroundColor: tenant.primaryColor } : undefined}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    activeTab === 'sync' ? 'text-white' : 'text-emerald-600'
                  }`}
                />
                <span>Admin Sync Bancos</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Catálogo de Imóveis em Leilão
            </h1>
            <p className="text-xs text-slate-600 font-medium mt-1">
              Oportunidades da Caixa Econômica, Bradesco, Santander, Itaú, Banco do Brasil, Portal Zuk, Mega Leilões e Judiciais.
            </p>

            {/* Pills Únicas de Bancos e Origens */}
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              {[
                { id: 'ALL', label: 'Todos' },
                { id: 'CAIXA', label: 'Caixa' },
                { id: 'BRADESCO', label: 'Bradesco' },
                { id: 'SANTANDER', label: 'Santander' },
                { id: 'ITAU', label: 'Itaú' },
                { id: 'BB', label: 'Banco do Brasil' },
                { id: 'JUDICIAL', label: 'Judicial' },
                { id: 'ZUK', label: 'Portal Zuk' },
                { id: 'MEGA', label: 'Mega Leilões' },
              ].map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBank(b.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedBank === b.id
                      ? 'text-white font-black shadow-sm'
                      : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200/90 hover:border-slate-300'
                  }`}
                  style={selectedBank === b.id ? { backgroundColor: tenant.primaryColor } : undefined}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-4 text-xs bg-white/80 backdrop-blur-sm px-4 py-3 rounded-2xl border border-slate-200/90 shadow-xs shrink-0">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wide">Encontrados</span>
              <span className="text-emerald-600 font-black text-sm">{totalCount.toLocaleString()} imóveis</span>
            </div>
            {summaryStats.totalActiveCount > 0 && (
              <div className="sm:border-l sm:border-slate-200 sm:pl-4">
                <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wide">Base Ativa</span>
                <span className="text-slate-900 font-black text-sm">{summaryStats.totalActiveCount.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* SELO VISÍVEL DE ATUALIZAÇÃO REAL POR BANCO */}
        {bankFreshness.length > 0 && (
          <div className="pt-3 border-t border-slate-200/80 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] mr-1">
              Última Atualização dos Bancos:
            </span>
            {bankFreshness
              .filter((b) => b.activeCount > 0 || ['CAIXA', 'BRADESCO', 'SANTANDER', 'ITAU'].includes(b.source))
              .map((b) => {
              const syncDate = b.lastSyncedAt ? new Date(b.lastSyncedAt) : null;
              const isRecent =
                syncDate !== null && !isNaN(syncDate.getTime()) && Date.now() - syncDate.getTime() < 48 * 3600 * 1000;
              const genDateFormatted = b.sourceGeneratedAt
                ? b.sourceGeneratedAt.split('-').reverse().join('/')
                : null;
              const syncFormatted =
                syncDate && !isNaN(syncDate.getTime())
                  ? syncDate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                  : null;

              return (
                <div
                  key={b.source}
                  className="bg-white/75 border border-slate-200/80 px-2.5 py-1 rounded-xl flex items-center gap-1.5"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      b.activeCount === 0
                        ? 'bg-slate-400'
                        : isRecent
                        ? 'bg-emerald-500'
                        : 'bg-amber-500'
                    }`}
                  />
                  <span className="font-black text-slate-900">{b.source}</span>
                  {b.activeCount > 0 ? (
                    <span className="text-slate-600">
                      · {b.activeCount.toLocaleString()} ativos
                      {genDateFormatted ? ` · Base ${genDateFormatted}` : ''}
                      {syncFormatted ? ` · Sync ${syncFormatted}` : ''}
                    </span>
                  ) : (
                    <span className="text-slate-500">· Sem carga ativa</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeTab === 'sync' && tenant.features.adminSync ? (
        <div className="space-y-6">
          <BancosAdminPage
            onGoToCatalog={() => {
              setActiveTab('catalog');
              executeSearch(1);
            }}
          />
        </div>
      ) : (
        <>
      {/* PAINEL DE FILTROS EM 2 NÍVEIS (ENXUTO + AVANÇADO) */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        {/* Nível 1: Filtros Principais Sempre Visíveis */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end text-xs">
          {/* ESTADO (UF) */}
          <div className="space-y-1">
            <label className="font-bold text-slate-600 uppercase text-[10px]">Estado (UF)</label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800 focus:ring-2 focus:ring-slate-400"
            >
              {availableStates.map((uf) => (
                <option key={uf} value={uf}>
                  {uf} — {uf === 'SP' ? 'São Paulo' : uf === 'RJ' ? 'Rio de Janeiro' : uf === 'MG' ? 'Minas Gerais' : uf === 'DF' ? 'Distrito Federal' : uf}
                </option>
              ))}
            </select>
          </div>

          {/* CIDADE */}
          <div className="space-y-1 relative">
            <label className="font-bold text-slate-600 uppercase text-[10px]">Cidade</label>
            <div className="relative">
              <input
                type="text"
                placeholder={selectedCity ? selectedCity : `Todas (${availableCities.length})`}
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-900 text-xs placeholder:text-slate-400"
                list="cities-datalist"
              />
              {selectedCity && (
                <button
                  onClick={() => setSelectedCity('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  title="Limpar cidade"
                >
                  ✕
                </button>
              )}
            </div>
            <datalist id="cities-datalist">
              {availableCities.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
          </div>

          {/* PREÇO MÁXIMO */}
          <div className="space-y-1">
            <label className="font-bold text-slate-600 uppercase text-[10px]">Preço Máximo (R$)</label>
            <input
              type="number"
              placeholder="Até R$"
              value={priceMaxInput}
              onChange={(e) => setPriceMaxInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold"
            />
          </div>

          {/* DESCONTO MÍNIMO */}
          <div className="space-y-1">
            <label className="font-bold text-slate-600 uppercase text-[10px]">Desconto Mínimo</label>
            <select
              value={discountMin !== undefined ? discountMin : ''}
              onChange={(e) => setDiscountMin(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800"
            >
              <option value="">Qualquer Desconto</option>
              <option value="10">10%+ de Desconto</option>
              <option value="20">20%+ de Desconto</option>
              <option value="30">30%+ de Desconto</option>
              <option value="40">40%+ de Desconto</option>
              <option value="50">50%+ de Desconto</option>
              <option value="60">60%+ de Desconto</option>
            </select>
          </div>

          {/* TOGGLE MAIS FILTROS */}
          <button
            type="button"
            onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3 py-2.5 rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 transition-colors"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Mais Filtros</span>
            {activeAdvancedFilterCount > 0 && (
              <span
                className="text-white text-[10px] font-black px-1.5 py-0.2 rounded-full"
                style={{ backgroundColor: tenant.primaryColor }}
              >
                {activeAdvancedFilterCount}
              </span>
            )}
            {isAdvancedFiltersOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* BUSCAR */}
          <button
            onClick={() => executeSearch(1)}
            disabled={loading}
            className="w-full text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center justify-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${tenant.primaryColor}, ${tenant.accentColor})`,
            }}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Buscar</span>
          </button>
        </div>

        {/* Nível 2: Gaveta de Filtros Avançados */}
        {isAdvancedFiltersOpen && (
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
              {/* TIPO DO IMÓVEL */}
              <div className="space-y-1">
                <label className="font-bold text-slate-600 uppercase text-[10px]">Tipo do Imóvel</label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800"
                >
                  <option value="Todos">Todos os Tipos</option>
                  {availableTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* MODALIDADE DE VENDA */}
              <div className="space-y-1">
                <label className="font-bold text-slate-600 uppercase text-[10px]">Modalidade de Venda</label>
                <select
                  value={saleModality}
                  onChange={(e) => setSaleModality(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800"
                >
                  <option value="Todas">Todas as Modalidades</option>
                  {availableModalities.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* PREÇO MÍNIMO */}
              <div className="space-y-1">
                <label className="font-bold text-slate-600 uppercase text-[10px]">Preço Mínimo (R$)</label>
                <input
                  type="number"
                  placeholder="A partir de R$"
                  value={priceMinInput}
                  onChange={(e) => setPriceMinInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold"
                />
              </div>

              {/* VALOR DE AVALIAÇÃO */}
              <div className="space-y-1">
                <label className="font-bold text-slate-600 uppercase text-[10px]">Valor de Avaliação (R$)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="De R$"
                    value={appraisalMinInput}
                    onChange={(e) => setAppraisalMinInput(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                  <input
                    type="number"
                    placeholder="Até R$"
                    value={appraisalMaxInput}
                    onChange={(e) => setAppraisalMaxInput(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>

              {/* FINANCIAMENTO */}
              <div className="space-y-1">
                <label className="font-bold text-slate-600 uppercase text-[10px]">Financiamento</label>
                <select
                  value={financing === null ? 'todos' : financing ? 'sim' : 'nao'}
                  onChange={(e) => setFinancing(e.target.value === 'todos' ? null : e.target.value === 'sim')}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800"
                >
                  <option value="todos">Todos</option>
                  <option value="sim">Financiável</option>
                  <option value="nao">Somente à vista</option>
                </select>
              </div>

              {/* OCUPAÇÃO */}
              <div className="space-y-1">
                <label className="font-bold text-slate-600 uppercase text-[10px]">Ocupação</label>
                <select
                  value={occupancy || ''}
                  onChange={(e) => setOccupancy((e.target.value as any) || null)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800"
                >
                  <option value="">Todos</option>
                  <option value="OCCUPIED">Ocupado</option>
                  <option value="VACANT">Desocupado</option>
                  <option value="UNKNOWN">Não informado</option>
                </select>
              </div>

              {/* ÁREA */}
              <div className="space-y-1 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-600 uppercase text-[10px]">Filtro de Área (m²)</label>
                  <select
                    value={areaType}
                    onChange={(e) => setAreaType(e.target.value as any)}
                    className="text-[10px] font-bold text-slate-700 bg-slate-100 rounded-lg px-2 py-0.5"
                  >
                    <option value="private_area">Área privativa</option>
                    <option value="total_area">Área total</option>
                    <option value="land_area">Área do terreno</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="De m²"
                    value={areaMinInput}
                    onChange={(e) => setAreaMinInput(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                  <input
                    type="number"
                    placeholder="Até m²"
                    value={areaMaxInput}
                    onChange={(e) => setAreaMaxInput(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <span className="text-[11px] text-slate-500">
                Filtros aplicados em conjunto para refinar oportunidades.
              </span>
              <button
                onClick={handleClearFilters}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpar Filtros</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* BARRA DE RESULTADOS, VIEW MODE (LISTA / MAPA) E ORDENAÇÃO */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-xs">
        <div className="font-bold text-slate-800">
          Exibindo {properties.length > 0 ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, totalCount)} de {totalCount.toLocaleString()} imóveis
          {isMemoryFallback && (
            <span className="text-amber-600 font-normal ml-2">(Base local offline)</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {/* Toggle Lista / Mapa+Lista / Mapa */}
          {tenant.features.map && (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all ${
                  viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Lista</span>
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all ${
                  viewMode === 'split' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Columns2 className="w-3.5 h-3.5" />
                <span>Mapa + Lista</span>
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all ${
                  viewMode === 'map' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Mapa</span>
              </button>
            </div>
          )}

          {/* SELETOR DE ORDENAÇÃO */}
          <div className="flex items-center space-x-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-900 text-xs"
            >
              <option value="discount_desc">Maior desconto</option>
              <option value="price_asc">Menor preço</option>
              <option value="appraisal_desc">Maior avaliação</option>
              <option value="area_desc">Maior área</option>
              <option value="recent_desc">Mais recentes</option>
              <option value="neighborhood_asc">Bairro (A-Z)</option>
              <option value="address_asc">Rua / Logradouro (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* MAPA INTEGRADO (QUANDO MODO FOR MAP OU SPLIT) */}
      {tenant.features.map && (viewMode === 'map' || viewMode === 'split') && !loading && adaptedPropertiesForMap.length > 0 && (
        <PropertyMap
          properties={adaptedPropertiesForMap}
          selectedProperty={adaptedPropertiesForMap[0]}
          onSelectProperty={(p) => {
            if (onOpenDetail360) onOpenDetail360(p);
          }}
          activeLayer={activeMapLayer}
          setActiveLayer={setActiveMapLayer}
        />
      )}

      {/* LISTA DE CARDS DE IMÓVEIS */}
      {viewMode !== 'map' && (loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 bg-white rounded-3xl border border-slate-200">
          <RefreshCw className="w-8 h-8 animate-spin" style={{ color: tenant.primaryColor }} />
          <span className="text-xs font-black text-slate-700">Consultando oportunidades...</span>
        </div>
      ) : properties.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 bg-white rounded-3xl border border-slate-200 text-center p-6">
          <Building2 className="w-12 h-12 text-slate-300 stroke-1" />
          <h3 className="text-base font-black text-slate-800">Nenhum imóvel encontrado</h3>
          <p className="text-xs text-slate-500 max-w-md">
            Nenhum imóvel encontrado com os critérios informados. Tente ajustar o preço, desconto ou cidade selecionada.
          </p>
          <button
            onClick={handleClearFilters}
            className="mt-2 bg-slate-900 text-white font-bold text-xs px-6 py-3 rounded-2xl"
          >
            Limpar Filtros e Ver Todos
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {properties.map((prop, index) => {
            const hasPrivArea = prop.private_area !== null && prop.private_area > 0;
            const hasTotalArea = prop.total_area !== null && prop.total_area > 0;
            const areaDisplay = hasPrivArea 
              ? `${(prop.private_area > 10000 && Number.isInteger(prop.private_area) ? prop.private_area / 100 : prop.private_area).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} m² privativos` 
              : hasTotalArea 
                ? `${(prop.total_area > 10000 && Number.isInteger(prop.total_area) ? prop.total_area / 100 : prop.total_area).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} m² totais` 
                : null;

            const isOccupied = prop.occupancy_status === 'OCCUPIED';
            const isVacant = prop.occupancy_status === 'VACANT';
            const isCaixa = !prop.source || prop.source === 'CAIXA';

            return (
              <div
                key={prop.id || `${prop.source || 'PROP'}_${prop.source_property_id || index}_${index}`}
                className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Foto Principal com Fallback Inteligente */}
                  <div className="relative h-48 w-full bg-slate-900 overflow-hidden border-b border-slate-100 flex flex-col items-center justify-center">
                    {(() => {
                      const rawId = prop.source_property_id || prop.hdnimovel || '';
                      const cleanHdn = String(rawId).replace(/\D/g, '') || extractHdnImovelFromUrl(prop.source_url || '');
                      const isCaixa = !prop.source || prop.source === 'CAIXA';
                      const officialPhotoUrl = prop.main_photo_url || (isCaixa && cleanHdn ? `https://venda-imoveis.caixa.gov.br/fotos/F${cleanHdn}21.jpg` : '');

                      const type = (prop.property_type || '').toLowerCase();
                      const houseFallbacks = [
                        'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80',
                        'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=800&q=80',
                        'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80',
                      ];
                      const hashIdx = Math.abs(String(rawId || index).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
                      const defaultPlaceholder = type.includes('casa')
                        ? houseFallbacks[hashIdx % houseFallbacks.length]
                        : type.includes('terreno')
                        ? 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80'
                        : type.includes('comercial') || type.includes('sala') || type.includes('loja')
                        ? 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80'
                        : 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80';

                      return (
                        <img
                          src={officialPhotoUrl || defaultPlaceholder}
                          alt={prop.title || 'Imóvel CAIXA'}
                          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = defaultPlaceholder;
                          }}
                        />
                      );
                    })()}

                    {/* Destaque do Desconto (Seção 35) - Não exibir se imóvel estiver Sob Consulta ou >= 100% */}
                    {(() => {
                      const minPrice = prop.current_minimum_value || prop.sale_value || 0;
                      const isSobConsulta = !minPrice || minPrice <= 0;
                      const rawDiscount = prop.discount_percentage;
                      
                      if (isSobConsulta || rawDiscount === null || rawDiscount === undefined) return null;
                      const discount = rawDiscount > 100 ? rawDiscount / 100 : rawDiscount;
                      if (discount <= 0 || discount >= 100) return null;

                      return (
                        <div className="absolute top-3 left-3 bg-red-600 text-white font-black text-xs px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                          <BadgePercent className="w-3.5 h-3.5" />
                          <span>{discount.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}% abaixo da avaliação</span>
                        </div>
                      );
                    })()}

                    {/* Badge 1º e 2º Leilão ou Data do Leilão */}
                    {(() => {
                      const aInfo = getAuctionValues(prop);
                      if (aInfo.hasBothAuctions) {
                        return (
                          <div className="absolute top-11 left-3 bg-amber-500 text-slate-950 font-black text-[10px] px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1 border border-amber-300">
                            {aInfo.firstAuctionExpired
                              ? `⚡ 2º Leilão: ${aInfo.formattedSecondAuctionDate || aInfo.formattedMainAuctionDate || 'Ativo'}`
                              : aInfo.formattedFirstAuctionDate
                              ? `⚡ 1º Leilão: ${aInfo.formattedFirstAuctionDate}`
                              : '⚡ 1º e 2º Leilão'}
                          </div>
                        );
                      }
                      if (aInfo.formattedMainAuctionDate) {
                        return (
                          <div className="absolute top-11 left-3 bg-orange-600 text-white font-black text-[10px] px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1">
                            📅 {aInfo.formattedMainAuctionDate}
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* ID do Imóvel Padrão de Auditoria */}
                    <div className="absolute bottom-2 right-2 bg-slate-900/85 text-orange-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg backdrop-blur-xs border border-slate-700/50">
                      ID: {formatStandardPropertyId(prop.source, prop.source_property_id || prop.id, prop)}
                    </div>
                  </div>

                  {(() => {
                    const auctionInfo = getAuctionValues(prop);
                    const paymentInfo = getPaymentConditions(prop);

                    return (
                      <div className="p-5 space-y-4">
                        {/* Cabeçalho do Card - Padronizado igual ao 1º Card */}
                        <div>
                          <div className="flex items-center space-x-2 text-[11px] font-black uppercase tracking-wider mb-1">
                            {prop.source === 'SANTANDER' && (
                              <span className="bg-red-600 text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Santander
                              </span>
                            )}
                            {prop.source === 'BRADESCO' && (
                              <span className="bg-red-800 text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Bradesco
                              </span>
                            )}
                            {(prop.source === 'BB' || prop.source === 'BRASIL') && (
                              <span className="bg-yellow-400 text-blue-950 font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider border border-yellow-500">
                                Banco do Brasil
                              </span>
                            )}
                            {prop.source === 'ITAU' && (
                              <span className="bg-orange-600 text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Itaú
                              </span>
                            )}
                            {prop.source === 'JUDICIAL' && (
                              <span className="bg-purple-700 text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Judicial
                              </span>
                            )}
                            {prop.source === 'ZUK' && (
                              <span className="bg-indigo-600 text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Portal Zuk
                              </span>
                            )}
                            {prop.source === 'MEGA' && (
                              <span className="bg-sky-700 text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Mega Leilões
                              </span>
                            )}
                            {(!prop.source || prop.source === 'CAIXA') && (
                              <span className="bg-blue-600 text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Caixa
                              </span>
                            )}

                            <span className="text-orange-600">{prop.property_type || 'Imóvel'}</span>
                            <span className="text-slate-400">•</span>
                            <span className="flex items-center gap-0.5 text-slate-500 font-bold">
                              <MapPin className="w-3 h-3 text-orange-500" /> {prop.city} / {prop.state}
                            </span>
                          </div>

                          <h3 className="text-sm font-black text-slate-900 line-clamp-2 leading-snug">
                            {extractCleanPropertyAddress(prop)}
                          </h3>

                          {prop.neighborhood && (
                            <p className="text-[11px] font-bold text-slate-500 mt-1 truncate">
                              Bairro: {prop.neighborhood}
                            </p>
                          )}
                        </div>

                        {/* Valoração Financeira (Se houver 1º e 2º leilão, apresenta ambos) */}
                        {auctionInfo.hasBothAuctions ? (
                          <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200 space-y-2 text-xs">
                            <div className="flex items-center justify-between pb-1.5 border-b border-amber-200/80">
                              <span className="text-[10px] font-black text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-md flex items-center gap-1">
                                ⚡ {auctionInfo.firstAuctionExpired ? '2º LEILÃO ATIVO (1ª PRAÇA ENCERRADA)' : 'LEILÃO EM 2 PRAÇAS'}
                              </span>
                              <span className="text-[9px] font-bold text-amber-800" title="Para filtros de preço, o sistema considera o maior valor">
                                Filtro: {formatCurrencyBRL(auctionInfo.higherPriceForFilter)}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-slate-500 font-bold block text-[9px] uppercase">1º LEILÃO:</span>
                                <span className="text-xs font-black text-slate-800">
                                  {formatCurrencyBRL(auctionInfo.firstAuctionValue)}
                                </span>
                                {auctionInfo.formattedFirstAuctionDate ? (
                                  <span className="text-[10px] font-bold text-amber-900 bg-amber-100/90 px-1.5 py-0.5 rounded block truncate mt-0.5" title={auctionInfo.formattedFirstAuctionDate}>
                                    📅 {auctionInfo.formattedFirstAuctionDate}
                                  </span>
                                ) : auctionInfo.firstAuctionExpired ? (
                                  <span className="text-[9px] font-bold text-slate-400 block truncate mt-0.5">
                                    ⚠️ 1ª Praça encerrada
                                  </span>
                                ) : null}
                              </div>
                              <div>
                                <span className="text-slate-500 font-bold block text-[9px] uppercase">2º LEILÃO ({prop.source || 'BANCO'}):</span>
                                <span className="text-sm font-black text-emerald-600">
                                  {formatCurrencyBRL(auctionInfo.secondAuctionValue)}
                                </span>
                                {auctionInfo.formattedSecondAuctionDate ? (
                                  <span className="text-[10px] font-bold text-emerald-900 bg-emerald-100/90 px-1.5 py-0.5 rounded block truncate mt-0.5" title={auctionInfo.formattedSecondAuctionDate}>
                                    📅 {auctionInfo.formattedSecondAuctionDate}
                                  </span>
                                ) : null}
                                {auctionInfo.firstAuctionExpired && (
                                  <span className="text-[9px] font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded uppercase block mt-1">
                                    🎯 Praça Ativa
                                  </span>
                                )}
                              </div>
                            </div>
                            {auctionInfo.formattedMainAuctionDate && (
                              <div className="flex items-center justify-between text-[10px] text-orange-900 font-extrabold pt-1.5 border-t border-amber-200/60">
                                <span className="flex items-center gap-1">📅 Prazo do Leilão Ativo:</span>
                                <span className="bg-white px-2 py-0.5 rounded border border-amber-300 font-black">
                                  {auctionInfo.formattedMainAuctionDate}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {auctionInfo.formattedMainAuctionDate && (
                              <div className="bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-xl flex items-center justify-between text-[11px]">
                                <span className="text-orange-900 font-bold text-[10px] uppercase flex items-center gap-1">
                                  📅 Data do Leilão / Prazo:
                                </span>
                                <span className="text-orange-950 font-black text-xs bg-white px-2 py-0.5 rounded-lg border border-orange-200 shadow-2xs">
                                  {auctionInfo.formattedMainAuctionDate}
                                </span>
                              </div>
                            )}
                            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-slate-400 font-bold block text-[9px] uppercase">
                                  PREÇO MÍNIMO {prop.source || 'CAIXA'}:
                                </span>
                                <span className="text-base font-black text-emerald-600">
                                  {prop.current_minimum_value || prop.sale_value ? formatCurrencyBRL(prop.current_minimum_value || prop.sale_value) : 'Sob Consulta'}
                                </span>
                              </div>

                              <div>
                                <span className="text-slate-400 font-bold block text-[9px] uppercase">AVALIAÇÃO:</span>
                                <span className="text-xs font-extrabold text-slate-700 line-through">
                                  {prop.appraisal_value ? formatCurrencyBRL(prop.appraisal_value) : 'N/I'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Atributos Básicos com Financiamento e Parcelamento */}
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          {/* Área no Card */}
                          {areaDisplay && (
                            <div className="bg-slate-100 p-2 rounded-xl border border-slate-200/60 font-bold text-slate-800 truncate">
                              📐 {areaDisplay}
                            </div>
                          )}

                          {/* Financiamento */}
                          <div 
                            className={`p-2 rounded-xl border font-bold truncate ${paymentInfo.canFinance ? 'bg-slate-100 border-slate-200/60 text-slate-800' : 'bg-amber-50 border-amber-200 text-amber-900'}`}
                            title={paymentInfo.paymentConditionsText}
                          >
                            💰 {paymentInfo.canFinance ? 'Financiável' : 'Somente à vista'}
                          </div>

                          {/* Quantidade máxima de parcelas disponíveis */}
                          {paymentInfo.canFinance && paymentInfo.maxInstallments > 1 && (
                            <div 
                              className="bg-emerald-50 text-emerald-900 border border-emerald-200 p-2 rounded-xl font-bold truncate text-[10px]"
                              title={`Até ${paymentInfo.maxInstallments} meses | Entrada mínima: ${formatCurrencyBRL(paymentInfo.minDownPayment)} | Parcelas a partir de: ${formatCurrencyBRL(paymentInfo.minInstallmentValue)}/mês`}
                            >
                              💳 Até {paymentInfo.maxInstallments}x parcelas
                            </div>
                          )}

                          {!paymentInfo.canFinance && prop.source === 'SANTANDER' && (
                            <div 
                              className="bg-amber-100/70 text-amber-900 border border-amber-300 p-2 rounded-xl font-black text-[9px] truncate"
                              title="O Santander somente financia imóveis com valor de venda a partir de R$ 90 mil"
                            >
                              ⚠️ Santander: Mín. R$ 90 mil
                            </div>
                          )}

                          {/* Ocupação */}
                          <div className={`bg-slate-100 p-2 rounded-xl border border-slate-200/60 font-bold text-slate-800 truncate ${paymentInfo.canFinance && paymentInfo.maxInstallments > 1 ? '' : 'col-span-2'}`}>
                            🏠 {isOccupied ? 'Ocupado' : isVacant ? 'Desocupado' : 'Ocupação: N/I'}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* BOTÕES DO CARD (Enxutos e Escaneáveis) */}
                <div className="p-4 pt-0 space-y-2">
                  <div className={`grid gap-2 ${onOpenJourney ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <button
                      onClick={() => setSelectedDetailProperty(prop)}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl transition-colors flex items-center justify-center"
                    >
                      <span>Ver Detalhes</span>
                    </button>

                    {onOpenJourney && (
                      <button
                        onClick={() => onOpenJourney(prop)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1"
                      >
                        <Route className="w-3.5 h-3.5" />
                        <span>Minha Jornada</span>
                      </button>
                    )}
                  </div>

                  {/* Barra compacta de ações secundárias */}
                  {(() => {
                    const mapsInfo = cleanCaixaAddressForMaps(prop.address, prop.city, prop.state);
                    const bankUrl =
                      prop.source_url ||
                      (isCaixa
                        ? getCaixaPropertyPageUrl(prop)
                        : prop.source === 'BB'
                        ? 'https://www.seuimovelbb.com.br'
                        : prop.source === 'BRADESCO'
                        ? 'https://vitrinebradesco.com.br'
                        : 'https://www.santanderimoveis.com.br');

                    return (
                      <div className="grid grid-cols-4 gap-1.5 text-[10px] font-bold">
                        <a
                          href={bankUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Abrir no portal ${prop.source || 'CAIXA'}`}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-1.5 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                          <span>Banco</span>
                        </a>

                        <a
                          href={mapsInfo.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir Google Maps & Street View"
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-1.5 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors"
                        >
                          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Mapa 360°</span>
                        </a>

                        <button
                          onClick={() => setSelectedFinancingProperty(prop)}
                          title="Simular Financiamento"
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-1.5 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors"
                        >
                          <Calculator className="w-3.5 h-3.5 text-blue-600" />
                          <span>Financiar</span>
                        </button>

                        <button
                          onClick={() => setSelectedEditalProperty(prop)}
                          title="Analisar Edital com IA"
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-1.5 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5" style={{ color: tenant.primaryColor }} />
                          <span>Edital IA</span>
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* CONTROLES DE PAGINAÇÃO */}
      {viewMode !== 'map' && totalPages > 1 && (
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-xs font-bold">
          <button
            onClick={() => executeSearch(page - 1)}
            disabled={page === 1 || loading}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl disabled:opacity-40 flex items-center space-x-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Anterior</span>
          </button>

          <div className="flex items-center space-x-1">
            <span>Página</span>
            <span className="font-black text-orange-600">{page}</span>
            <span>de</span>
            <span className="font-black text-slate-900">{totalPages}</span>
          </div>

          <button
            onClick={() => executeSearch(page + 1)}
            disabled={page >= totalPages || loading}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl disabled:opacity-40 flex items-center space-x-1"
          >
            <span>Próxima</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
        </>
      )}

      {/* MODAL DE DETALHES DO IMÓVEL (/imoveis/:id - Seção 38) */}
      {selectedDetailProperty && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm p-4 flex items-center justify-center overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-3xl border border-slate-200 overflow-hidden shadow-2xl space-y-6 max-h-[90vh] flex flex-col justify-between">
            
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-orange-400 font-mono">
                  ID: {formatStandardPropertyId(selectedDetailProperty.source, selectedDetailProperty.source_property_id || selectedDetailProperty.id, selectedDetailProperty)}
                </span>
                <h2 className="text-lg font-black text-white leading-snug">
                  {selectedDetailProperty.property_type || 'Imóvel'} — {selectedDetailProperty.city} / {selectedDetailProperty.state}
                </h2>
              </div>

              <button
                onClick={() => setSelectedDetailProperty(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs font-sans">
              
              {/* Valoração Financeira com Suporte a 1º e 2º Leilão */}
              {(() => {
                const aInfo = getAuctionValues(selectedDetailProperty);
                if (aInfo.hasBothAuctions) {
                  return (
                    <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-amber-200">
                        <span className="text-xs font-black text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                          ⚡ {aInfo.firstAuctionExpired ? '2º LEILÃO ATIVO (1ª PRAÇA JÁ ENCERRADA)' : 'LEILÃO EM 2 PRAÇAS (1º E 2º LEILÃO)'}
                        </span>
                        <span className="text-[11px] font-bold text-amber-800" title="Para filtros de preço, o sistema utiliza o maior valor">
                          Filtro de busca utiliza o maior valor: {formatCurrencyBRL(aInfo.higherPriceForFilter)}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-white p-3 rounded-xl border border-amber-200/80">
                          <span className="text-slate-400 font-bold block text-[10px]">1º LEILÃO:</span>
                          <span className="text-base font-black text-slate-800">
                            {formatCurrencyBRL(aInfo.firstAuctionValue)}
                          </span>
                          {aInfo.formattedFirstAuctionDate ? (
                            <span className="text-[11px] font-bold text-slate-600 block mt-0.5">
                              📅 {aInfo.formattedFirstAuctionDate}
                            </span>
                          ) : aInfo.firstAuctionExpired ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded inline-block mt-1">
                              ⚠️ 1ª Praça já encerrada
                            </span>
                          ) : null}
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-emerald-200">
                          <span className="text-slate-400 font-bold block text-[10px]">2º LEILÃO (LANCE MÍNIMO):</span>
                          <span className="text-lg font-black text-emerald-600">
                            {formatCurrencyBRL(aInfo.secondAuctionValue)}
                          </span>
                          {aInfo.formattedSecondAuctionDate && (
                            <span className="text-[11px] font-bold text-emerald-700 block mt-0.5">
                              📅 {aInfo.formattedSecondAuctionDate}
                            </span>
                          )}
                          {aInfo.firstAuctionExpired && (
                            <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded uppercase inline-block mt-1">
                              🎯 Praça Ativa
                            </span>
                          )}
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <span className="text-slate-400 font-bold block text-[10px]">DESCONTO MÁXIMO:</span>
                          <span className="text-base font-extrabold text-orange-600">
                            {selectedDetailProperty.discount_percentage ? `${selectedDetailProperty.discount_percentage}%` : 'N/I'}
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">no 2º Leilão</span>
                        </div>
                      </div>
                      {aInfo.formattedMainAuctionDate && (
                        <div className="bg-white border border-amber-300 p-2.5 rounded-xl flex items-center justify-between mt-2">
                          <span className="text-amber-950 font-black text-xs uppercase flex items-center gap-1.5">
                            📅 Data do Leilão Ativo:
                          </span>
                          <span className="text-amber-950 font-black text-xs bg-amber-100 px-2.5 py-0.5 rounded-lg border border-amber-300 shadow-2xs">
                            {aInfo.formattedMainAuctionDate}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {aInfo.formattedMainAuctionDate && (
                      <div className="bg-orange-50 border border-orange-200 p-3 rounded-xl flex items-center justify-between">
                        <span className="text-orange-900 font-bold text-xs uppercase flex items-center gap-1.5">
                          📅 Data do Leilão / Prazo para Propostas:
                        </span>
                        <span className="text-orange-950 font-black text-xs bg-white px-2.5 py-1 rounded-lg border border-orange-200 shadow-2xs">
                          {aInfo.formattedMainAuctionDate}
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <div>
                        <span className="text-slate-400 font-bold block text-[10px]">PREÇO MÍNIMO {selectedDetailProperty.source || 'CAIXA'}:</span>
                        <span className="text-lg font-black text-emerald-600">
                          {selectedDetailProperty.current_minimum_value || selectedDetailProperty.sale_value ? formatCurrencyBRL(selectedDetailProperty.current_minimum_value || selectedDetailProperty.sale_value) : 'Sob Consulta'}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 font-bold block text-[10px]">AVALIAÇÃO:</span>
                        <span className="text-sm font-extrabold text-slate-700 line-through">
                          {selectedDetailProperty.appraisal_value ? formatCurrencyBRL(selectedDetailProperty.appraisal_value) : 'N/I'}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 font-bold block text-[10px]">DESCONTO:</span>
                        <span className="text-sm font-extrabold text-orange-600">
                          {(() => {
                            const minPrice = selectedDetailProperty.current_minimum_value || selectedDetailProperty.sale_value || 0;
                            const isSobConsulta = !minPrice || minPrice <= 0;
                            const rawDiscount = selectedDetailProperty.discount_percentage;
                            if (isSobConsulta || rawDiscount === null || rawDiscount === undefined) return 'Sob Consulta';
                            const discount = rawDiscount > 100 ? rawDiscount / 100 : rawDiscount;
                            if (discount <= 0 || discount >= 100) return 'Sob Consulta';
                            return `${discount.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Endereço Completo */}
              <div className="space-y-1">
                <span className="text-slate-400 font-bold text-[10px] uppercase">Endereço Completo:</span>
                <p className="text-slate-900 font-bold text-sm">{extractCleanPropertyAddress(selectedDetailProperty)}</p>
                {selectedDetailProperty.neighborhood && (
                  <p className="text-slate-500 font-medium">Bairro: {selectedDetailProperty.neighborhood}</p>
                )}
              </div>

              {/* Atributos Extraídos da Descrição */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block text-[10px]">ÁREA PRIVATIVA:</span>
                  <span className="font-extrabold text-slate-900">
                    {selectedDetailProperty.private_area !== null 
                      ? `${(selectedDetailProperty.private_area > 10000 && Number.isInteger(selectedDetailProperty.private_area) ? selectedDetailProperty.private_area / 100 : selectedDetailProperty.private_area).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} m²` 
                      : 'N/I'}
                  </span>
                </div>

                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block text-[10px]">ÁREA TOTAL:</span>
                  <span className="font-extrabold text-slate-900">
                    {selectedDetailProperty.total_area !== null 
                      ? `${(selectedDetailProperty.total_area > 10000 && Number.isInteger(selectedDetailProperty.total_area) ? selectedDetailProperty.total_area / 100 : selectedDetailProperty.total_area).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} m²` 
                      : 'N/I'}
                  </span>
                </div>

                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block text-[10px]">QUARTOS:</span>
                  <span className="font-extrabold text-slate-900">
                    {selectedDetailProperty.bedrooms !== null ? selectedDetailProperty.bedrooms : 'N/I'}
                  </span>
                </div>

                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block text-[10px]">FINANCIAMENTO:</span>
                  <span className="font-extrabold text-slate-900">
                    {selectedDetailProperty.source === 'SANTANDER' && (selectedDetailProperty.sale_value || 0) < 90000
                      ? 'Não (mín. R$ 90 mil)'
                      : selectedDetailProperty.accepts_financing ? 'Sim' : selectedDetailProperty.accepts_financing === false ? 'Não' : 'N/I'}
                  </span>
                </div>
              </div>

              {/* Condições de Pagamento e Financiamento Bancário */}
              {(() => {
                const pInfo = getPaymentConditions(selectedDetailProperty);
                const isSantander = selectedDetailProperty.source === 'SANTANDER';
                const isBradesco = selectedDetailProperty.source === 'BRADESCO';
                return (
                  <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center space-x-2 text-slate-900 font-black text-xs uppercase tracking-wider">
                        <CreditCard className="w-4 h-4 text-emerald-600" />
                        <span>CONDIÇÕES DE PAGAMENTO & FINANCIAMENTO BANCÁRIO</span>
                      </div>
                      {pInfo.canFinance && pInfo.maxInstallments > 1 && (
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full">
                          Até {pInfo.maxInstallments}x parcelas disponíveis
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-700 font-medium leading-relaxed bg-white p-3.5 rounded-2xl border border-slate-200/80">
                      {pInfo.paymentConditionsText}
                    </p>

                    {pInfo.canFinance ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        <div className="bg-white p-3 rounded-2xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">ENTRADA MÍNIMA *:</span>
                          <span className="text-sm font-black text-slate-900">
                            {formatCurrencyBRL(pInfo.minDownPayment)}
                          </span>
                          <span className="text-[9px] text-slate-500 block">
                            ({isSantander || isBradesco ? '20%' : '5% a 20%'} do valor de venda)
                          </span>
                        </div>

                        <div className="bg-white p-3 rounded-2xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">PARCELAS A PARTIR DE *:</span>
                          <span className="text-sm font-black text-emerald-600">
                            {formatCurrencyBRL(pInfo.minInstallmentValue)}/mês
                          </span>
                          <span className="text-[9px] text-slate-500 block">
                            em até {pInfo.maxInstallments} meses ({pInfo.maxInstallments / 12} anos)
                          </span>
                        </div>

                        <div className="bg-white p-3 rounded-2xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">REGRA DE FINANCIAMENTO:</span>
                          <span className="text-xs font-bold text-slate-800 block mt-0.5">
                            {isSantander ? 'Financia a partir de R$ 90 mil' : isBradesco ? 'Financia a partir de R$ 100 mil' : 'Financia até 95% do imóvel'}
                          </span>
                          <span className="text-[9px] text-slate-500 block">Sujeito a aprovação de crédito</span>
                        </div>
                      </div>
                    ) : isSantander ? (
                      <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl text-xs text-amber-900 font-medium flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Atenção: O Santander somente financia ofertas com valor a partir de R$ 90.000,00. Esta oferta deve ser liquidada à vista com recursos próprios.</span>
                      </div>
                    ) : null}
                  </div>
                );
              })()}

              {/* Descrição Original */}
              {selectedDetailProperty.description && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Descrição Original do Imóvel:</span>
                  <p className="text-slate-700 font-medium leading-relaxed">{selectedDetailProperty.description}</p>
                </div>
              )}

              {/* Botões de Localização no Google Maps & Waze */}
              {(() => {
                const mapsInfo = cleanCaixaAddressForMaps(
                  selectedDetailProperty.address,
                  selectedDetailProperty.city,
                  selectedDetailProperty.state
                );
                return (
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
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-3 rounded-xl transition-colors flex items-center justify-center space-x-2 text-center shadow-xs"
                      >
                        <MapPin className="w-4 h-4" />
                        <span>Ver no Google Maps</span>
                      </a>

                      <a
                        href={mapsInfo.wazeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs px-4 py-3 rounded-xl transition-colors flex items-center justify-center space-x-2 text-center shadow-xs"
                      >
                        <ExternalLink className="w-4 h-4 text-white" />
                        <span>Navegar via Waze</span>
                      </a>
                    </div>
                  </div>
                );
              })()}

              {/* Informações da Fonte */}
              <div className="p-3 bg-slate-100 rounded-xl text-[11px] font-mono text-slate-600 space-y-1">
                <div>Fonte Oficial: <strong>{selectedDetailProperty.source || 'CAIXA'}</strong></div>
                <div>Modalidade: <strong>{selectedDetailProperty.sale_modality || 'Venda Direta'}</strong></div>
                <div>Status da Ocupação: <strong>{selectedDetailProperty.occupancy_status || 'UNKNOWN'}</strong></div>
              </div>

            </div>

            {/* Rodapé do Modal */}
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => setSelectedDetailProperty(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs px-6 py-3 rounded-2xl"
              >
                Fechar
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {onOpenJourney && (
                  <button
                    onClick={() => {
                      onOpenJourney(selectedDetailProperty);
                      setSelectedDetailProperty(null);
                    }}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs px-5 py-3 rounded-2xl transition-all flex items-center space-x-1.5 shadow-md"
                  >
                    <Route className="w-4 h-4 text-emerald-100" />
                    <span>Iniciar Minha Jornada</span>
                  </button>
                )}

                <button
                  onClick={() => setSelectedEditalProperty(selectedDetailProperty)}
                  className="text-white font-bold text-xs px-5 py-3 rounded-2xl transition-opacity hover:opacity-95 flex items-center space-x-1.5 shadow-md"
                  style={{ backgroundColor: tenant.primaryColor }}
                >
                  <Sparkles className="w-4 h-4 text-white/90" />
                  <span>Analisar Edital (IA)</span>
                </button>

                <button
                  onClick={() => setSelectedFinancingProperty(selectedDetailProperty)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-3 rounded-2xl transition-colors flex items-center space-x-1.5 shadow-md"
                >
                  <Calculator className="w-4 h-4 text-blue-100" />
                  <span>Simular Financiamento</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Análise de Edital via G2 AI */}
      {selectedEditalProperty && (
        <EditalAnalysisModal
          property={selectedEditalProperty}
          onClose={() => setSelectedEditalProperty(null)}
        />
      )}

      {/* Modal do Simulador de Financiamento CAIXA */}
      {selectedFinancingProperty && (
        <FinanciamentoCaixaModal
          property={selectedFinancingProperty}
          onClose={() => setSelectedFinancingProperty(null)}
        />
      )}

    </div>
  );
};
