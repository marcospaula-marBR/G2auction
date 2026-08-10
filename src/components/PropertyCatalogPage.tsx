import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building2,
  MapPin,
  BadgePercent,
  Lock,
  ArrowUpDown,
  X,
  Sparkles,
} from 'lucide-react';

import {
  queryPropertiesFromSupabase,
  fetchDistinctStatesFromSupabase,
  fetchDistinctCitiesByStateFromSupabase,
  fetchDistinctPropertyTypesFromSupabase,
  fetchDistinctSaleModalitiesFromSupabase,
  fetchCatalogSummaryStatsFromSupabase,
  type PropertyFilterParams,
} from '../lib/supabaseClient';

import { formatCurrencyBRL } from '../utils/financial';

interface PropertyCatalogPageProps {
  onOpenAdmin?: () => void;
}

export const PropertyCatalogPage: React.FC<PropertyCatalogPageProps> = ({ onOpenAdmin }) => {
  // Estatísticas Resumidas da Base (Seção 17)
  const [summaryStats, setSummaryStats] = useState<{
    totalActiveCount: number;
    lastImportDate: string | null;
    lastImportGeneratedAt: string | null;
  }>({
    totalActiveCount: 0,
    lastImportDate: null,
    lastImportGeneratedAt: null,
  });

  // Opções Dinâmicas para os Selects (Seções 19, 20, 27, 28)
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [availableModalities, setAvailableModalities] = useState<string[]>([]);

  // Estados dos Filtros (Seção 18 a 30)
  const [selectedState, setSelectedState] = useState<string>('SP');
  const [selectedCity, setSelectedCity] = useState<string>('');
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
  const [sortBy, setSortBy] = useState<'discount_desc' | 'price_asc' | 'appraisal_desc' | 'area_desc' | 'recent_desc'>('discount_desc');
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

  // Painel de Filtros Expansível em Mobile
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState<boolean>(false);

  // Carregar estatísticas e opções dos selects no primeiro render
  useEffect(() => {
    async function loadInitialOptions() {
      const statsRes = await fetchCatalogSummaryStatsFromSupabase();
      setSummaryStats(statsRes);

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

    const params: PropertyFilterParams = {
      state: selectedState || undefined,
      city: selectedCity || undefined,
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

    setProperties(res.data);
    setTotalCount(res.totalCount);
    setTotalPages(res.totalPages);
    setIsMemoryFallback(res.isMemoryFallback);
    setLoading(false);
  }, [
    selectedState,
    selectedCity,
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

  // Executar busca inicial e quando mudar a ordenação
  useEffect(() => {
    executeSearch(1);
  }, [sortBy, executeSearch]);

  const handleClearFilters = () => {
    setSelectedState('SP');
    setSelectedCity('');
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
    <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6 font-sans">
      
      {/* BARRA SUPERIOR DO CATÁLOGO (Seção 17) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className="bg-orange-500 text-slate-950 font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> IMÓVEIS EM OPORTUNIDADE
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Base Oficial CAIXA
            </span>
          </div>

          {onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold px-4 py-2 rounded-2xl transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5 text-orange-400" />
              <span>Atualizar Base CAIXA</span>
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Catálogo de Imóveis CAIXA
            </h1>
            <p className="text-xs text-slate-300 font-medium mt-1">
              Pesquise diretamente em nosso banco de dados. Filtros instantâneos sem dependência do site da CAIXA durante a busca.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Encontrados:</span>
              <span className="text-emerald-400 font-black text-sm">{totalCount.toLocaleString()} imóveis</span>
            </div>
            <div className="h-6 w-px bg-slate-800 hidden sm:block" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Atualização CAIXA:</span>
              <span className="text-orange-400 font-bold">
                {summaryStats.lastImportGeneratedAt ? new Date(summaryStats.lastImportGeneratedAt).toLocaleDateString('pt-BR') : 'DD/MM/YYYY'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* BOTÃO TOGGLE DE FILTROS EM MOBILE */}
      <div className="lg:hidden">
        <button
          onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
          className="w-full bg-white border border-slate-200 p-4 rounded-2xl shadow-sm text-xs font-black text-slate-900 flex items-center justify-between"
        >
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-orange-500" />
            <span>PAINEL DE FILTROS ({totalCount.toLocaleString()} resultados)</span>
          </div>
          <span className="text-orange-600 uppercase text-[10px]">
            {isFilterPanelOpen ? 'Fechar Filtros' : 'Abrir Filtros'}
          </span>
        </button>
      </div>

      {/* PAINEL COMPLETO DE FILTROS (Seção 18 a 30) */}
      <div className={`bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 ${isFilterPanelOpen ? 'block' : 'hidden lg:block'}`}>
        
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h2 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
            <Filter className="w-4 h-4 text-orange-500" /> FILTRAR IMÓVEIS CAIXA
          </h2>

          <button
            onClick={handleClearFilters}
            className="text-xs font-bold text-slate-500 hover:text-orange-600 transition-colors flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>[ LIMPAR FILTROS ]</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 text-xs">
          
          {/* 1. ESTADO (UF) (Seção 19) */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 uppercase text-[10px]">ESTADO (UF):</label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800 focus:ring-2 focus:ring-orange-500"
            >
              {availableStates.map((uf) => (
                <option key={uf} value={uf}>
                  {uf} — {uf === 'SP' ? 'São Paulo' : uf === 'RJ' ? 'Rio de Janeiro' : uf === 'MG' ? 'Minas Gerais' : uf === 'DF' ? 'Distrito Federal' : uf}
                </option>
              ))}
            </select>
          </div>

          {/* 2. CIDADE DEPENDENTE DO ESTADO (Seção 20) */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 uppercase text-[10px]">CIDADE:</label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800 focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Todas as Cidades ({availableCities.length})</option>
              {availableCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          {/* 3. TIPO DO IMÓVEL (Seção 27) */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 uppercase text-[10px]">TIPO DO IMÓVEL:</label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800 focus:ring-2 focus:ring-orange-500"
            >
              <option value="Todos">Todos os Tipos</option>
              {availableTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* 4. MODALIDADE DE VENDA (Seção 28) */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 uppercase text-[10px]">MODALIDADE DE VENDA:</label>
            <select
              value={saleModality}
              onChange={(e) => setSaleModality(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800 focus:ring-2 focus:ring-orange-500"
            >
              <option value="Todas">Todas as Modalidades</option>
              {availableModalities.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* 5. PREÇO MÍNIMO CAIXA (INTERVALO) (Seção 21) */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 uppercase text-[10px]">PREÇO MÍNIMO CAIXA (R$):</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="De R$"
                value={priceMinInput}
                onChange={(e) => setPriceMinInput(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-orange-500"
              />
              <input
                type="number"
                placeholder="Até R$"
                value={priceMaxInput}
                onChange={(e) => setPriceMaxInput(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* 6. VALOR DE AVALIAÇÃO (INTERVALO) (Seção 22) */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 uppercase text-[10px]">VALOR DE AVALIAÇÃO (R$):</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="De R$"
                value={appraisalMinInput}
                onChange={(e) => setAppraisalMinInput(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-orange-500"
              />
              <input
                type="number"
                placeholder="Até R$"
                value={appraisalMaxInput}
                onChange={(e) => setAppraisalMaxInput(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* 7. DESCONTO MÍNIMO (Seção 23) */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 uppercase text-[10px]">DESCONTO MÍNIMO (%):</label>
            <select
              value={discountMin !== undefined ? discountMin : ''}
              onChange={(e) => setDiscountMin(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800 focus:ring-2 focus:ring-orange-500"
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

          {/* 8. FINANCIAMENTO (Seção 24) */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 uppercase text-[10px]">FINANCIAMENTO:</label>
            <select
              value={financing === null ? 'todos' : financing ? 'sim' : 'nao'}
              onChange={(e) => setFinancing(e.target.value === 'todos' ? null : e.target.value === 'sim')}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800 focus:ring-2 focus:ring-orange-500"
            >
              <option value="todos">Todos</option>
              <option value="sim">Financiável</option>
              <option value="nao">Não financiável</option>
            </select>
          </div>

          {/* 9. OCUPAÇÃO (Seção 25) */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 uppercase text-[10px]">OCUPAÇÃO:</label>
            <select
              value={occupancy || ''}
              onChange={(e) => setOccupancy((e.target.value as any) || null)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800 focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Todos</option>
              <option value="OCCUPIED">Ocupado</option>
              <option value="VACANT">Desocupado</option>
              <option value="UNKNOWN">Não informado</option>
            </select>
          </div>

          {/* 10. ÁREA E SELETOR DE COLUNA DE ÁREA (Seção 26) */}
          <div className="space-y-1.5 md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 uppercase text-[10px]">FILTRO DE ÁREA (m²):</label>
              <select
                value={areaType}
                onChange={(e) => setAreaType(e.target.value as any)}
                className="text-[10px] font-bold text-orange-600 bg-slate-100 rounded-lg px-2 py-0.5"
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
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-orange-500"
              />
              <input
                type="number"
                placeholder="Até m²"
                value={areaMaxInput}
                onChange={(e) => setAreaMaxInput(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

        </div>

        {/* BOTÃO BUSCAR IMÓVEIS (Seção 29) */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-500">
            * Todos os filtros são aplicados em conjunto (AND).
          </span>

          <button
            onClick={() => executeSearch(1)}
            disabled={loading}
            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-black text-xs px-8 py-3.5 rounded-2xl shadow-lg shadow-orange-500/20 flex items-center space-x-2 transition-all transform active:scale-95 disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            <span>[ BUSCAR IMÓVEIS ]</span>
          </button>
        </div>

      </div>

      {/* BARRA DE RESULTADOS E ORDENAÇÃO (Seção 32 & 33) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-xs">
        <div className="font-extrabold text-slate-800">
          Exibindo {properties.length > 0 ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, totalCount)} de {totalCount.toLocaleString()} imóveis encontrados
          {isMemoryFallback && (
            <span className="text-amber-600 font-normal ml-2"> (Store local de teste)</span>
          )}
        </div>

        {/* SELETOR DE ORDENAÇÃO (Seção 32) */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <ArrowUpDown className="w-4 h-4 text-orange-500" />
          <span className="font-bold text-slate-600 uppercase text-[10px]">ORDENAR POR:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-black text-slate-900 focus:ring-2 focus:ring-orange-500 text-xs flex-grow sm:flex-grow-0"
          >
            <option value="discount_desc">Maior desconto</option>
            <option value="price_asc">Menor preço</option>
            <option value="appraisal_desc">Maior avaliação</option>
            <option value="area_desc">Maior área</option>
            <option value="recent_desc">Mais recentes</option>
          </select>
        </div>
      </div>

      {/* LISTA DE CARDS DE IMÓVEIS (Seção 34 a 37) */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 bg-white rounded-3xl border border-slate-200">
          <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
          <span className="text-xs font-black text-slate-700">CONSULTANDO BANCO DE DADOS...</span>
        </div>
      ) : properties.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 bg-white rounded-3xl border border-slate-200 text-center p-6">
          <Building2 className="w-12 h-12 text-slate-300 stroke-1" />
          <h3 className="text-base font-black text-slate-800">NENHUM IMÓVEL ENCONTRADO</h3>
          <p className="text-xs text-slate-500 max-w-md">
            Nenhum imóvel CAIXA corresponde aos critérios informados. Tente ajustar o preço, desconto ou cidade selecionada.
          </p>
          <button
            onClick={handleClearFilters}
            className="mt-2 bg-slate-900 text-white font-bold text-xs px-6 py-3 rounded-2xl"
          >
            Limpar Filtros e Ver Todos
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((prop) => {
            const hasPrivArea = prop.private_area !== null && prop.private_area > 0;
            const hasTotalArea = prop.total_area !== null && prop.total_area > 0;
            const areaDisplay = hasPrivArea ? `${prop.private_area} m² privativos` : hasTotalArea ? `${prop.total_area} m² totais` : null;

            const isOccupied = prop.occupancy_status === 'OCCUPIED';
            const isVacant = prop.occupancy_status === 'VACANT';

            return (
              <div
                key={prop.id || prop.source_property_id}
                className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Foto Principal / Placeholder Neutro (Seção 34) */}
                  <div className="relative h-48 w-full bg-slate-100 overflow-hidden border-b border-slate-100 flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                    {prop.main_photo_url ? (
                      <img
                        src={prop.main_photo_url}
                        alt="Imóvel CAIXA"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <>
                        <Lock className="w-8 h-8 stroke-1 text-slate-400 mb-1" />
                        <span className="text-xs font-bold text-slate-600">Foto ainda não disponível</span>
                      </>
                    )}

                    {/* Destaque do Desconto (Seção 35) */}
                    {prop.discount_percentage !== null && prop.discount_percentage > 0 && (
                      <div className="absolute top-3 left-3 bg-red-600 text-white font-black text-xs px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                        <BadgePercent className="w-3.5 h-3.5" />
                        <span>{prop.discount_percentage}% abaixo da avaliação</span>
                      </div>
                    )}

                    {/* ID do Imóvel */}
                    <div className="absolute bottom-2 right-2 bg-slate-900/80 text-white text-[10px] font-mono px-2 py-0.5 rounded-lg backdrop-blur-xs">
                      ID: {prop.source_property_id}
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Cabeçalho do Card */}
                    <div>
                      <div className="flex items-center space-x-2 text-[11px] font-black text-orange-600 uppercase tracking-wider mb-1">
                        <span>{prop.property_type || 'Imóvel CAIXA'}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" /> {prop.city} / {prop.state}
                        </span>
                      </div>

                      <h3 className="text-sm font-black text-slate-900 line-clamp-2 leading-snug">
                        {prop.address || `Imóvel CAIXA em ${prop.city} / ${prop.state}`}
                      </h3>

                      {prop.neighborhood && (
                        <p className="text-[11px] font-bold text-slate-500 mt-1 truncate">
                          Bairro: {prop.neighborhood}
                        </p>
                      )}
                    </div>

                    {/* Valoração Financeira (Seção 5, 34) */}
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 font-bold block text-[9px] uppercase">PREÇO MÍNIMO CAIXA:</span>
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

                    {/* Atributos Básicos (Seção 36, 37) */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      {/* Área no Card (Seção 36) */}
                      {areaDisplay && (
                        <div className="bg-slate-100 p-2 rounded-xl border border-slate-200/60 font-bold text-slate-800 truncate">
                          📐 {areaDisplay}
                        </div>
                      )}

                      {/* Financiamento */}
                      <div className="bg-slate-100 p-2 rounded-xl border border-slate-200/60 font-bold text-slate-800 truncate">
                        💰 {prop.accepts_financing ? 'Financiável' : prop.accepts_financing === false ? 'Não financiável' : 'Financ: N/I'}
                      </div>

                      {/* Ocupação (Seção 37) */}
                      <div className="bg-slate-100 p-2 rounded-xl border border-slate-200/60 font-bold text-slate-800 truncate col-span-2">
                        🏠 Ocupação: {isOccupied ? 'Ocupado' : isVacant ? 'Desocupado' : 'Não informada'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* BOTÕES DO CARD (Seção 34) */}
                <div className="p-5 pt-0 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedDetailProperty(prop)}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black text-xs py-3 rounded-2xl transition-colors flex items-center justify-center space-x-1"
                  >
                    <span>[ VER OPORTUNIDADE ]</span>
                  </button>

                  <a
                    href={prop.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-xs py-3 rounded-2xl transition-colors flex items-center justify-center space-x-1 text-center"
                  >
                    <span>[ VER NA CAIXA ]</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CONTROLES DE PAGINAÇÃO (Seção 33) */}
      {totalPages > 1 && (
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

      {/* MODAL DE DETALHES DO IMÓVEL (/imoveis/:id - Seção 38) */}
      {selectedDetailProperty && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm p-4 flex items-center justify-center overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-3xl border border-slate-200 overflow-hidden shadow-2xl space-y-6 max-h-[90vh] flex flex-col justify-between">
            
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-orange-400 font-mono">
                  CAIXA ID TEXT: {selectedDetailProperty.source_property_id}
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
              
              {/* Valoração Financeira */}
              <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-400 font-bold block text-[10px]">PREÇO MÍNIMO CAIXA:</span>
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
                    {selectedDetailProperty.discount_percentage !== null ? `${selectedDetailProperty.discount_percentage}%` : 'N/I'}
                  </span>
                </div>
              </div>

              {/* Endereço Completo */}
              <div className="space-y-1">
                <span className="text-slate-400 font-bold text-[10px] uppercase">Endereço Completo:</span>
                <p className="text-slate-900 font-bold text-sm">{selectedDetailProperty.address || 'Endereço não detalhado'}</p>
                {selectedDetailProperty.neighborhood && (
                  <p className="text-slate-500 font-medium">Bairro: {selectedDetailProperty.neighborhood}</p>
                )}
              </div>

              {/* Atributos Extraídos da Descrição */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block text-[10px]">ÁREA PRIVATIVA:</span>
                  <span className="font-extrabold text-slate-900">
                    {selectedDetailProperty.private_area !== null ? `${selectedDetailProperty.private_area} m²` : 'N/I'}
                  </span>
                </div>

                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block text-[10px]">ÁREA TOTAL:</span>
                  <span className="font-extrabold text-slate-900">
                    {selectedDetailProperty.total_area !== null ? `${selectedDetailProperty.total_area} m²` : 'N/I'}
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
                    {selectedDetailProperty.accepts_financing ? 'Sim' : selectedDetailProperty.accepts_financing === false ? 'Não' : 'N/I'}
                  </span>
                </div>
              </div>

              {/* Descrição Original */}
              {selectedDetailProperty.description && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Descrição Original do Imóvel:</span>
                  <p className="text-slate-700 font-medium leading-relaxed">{selectedDetailProperty.description}</p>
                </div>
              )}

              {/* Informações da Fonte */}
              <div className="p-3 bg-slate-100 rounded-xl text-[11px] font-mono text-slate-600 space-y-1">
                <div>Fonte Oficial: <strong>CAIXA</strong></div>
                <div>Modalidade: <strong>{selectedDetailProperty.sale_modality || 'Venda Direta'}</strong></div>
                <div>Status da Ocupação: <strong>{selectedDetailProperty.occupancy_status || 'UNKNOWN'}</strong></div>
              </div>

            </div>

            {/* Rodapé do Modal */}
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setSelectedDetailProperty(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs px-6 py-3 rounded-2xl"
              >
                Fechar
              </button>

              <a
                href={selectedDetailProperty.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs px-6 py-3 rounded-2xl transition-colors flex items-center space-x-2 shadow-md"
              >
                <span>[ VER NA CAIXA ]</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
