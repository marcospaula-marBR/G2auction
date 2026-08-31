import React, { useState, useMemo } from 'react';
import type { Property } from '../types/auction';
import { Search, ShieldCheck, MapPin, ChevronRight, Calculator, Filter, RotateCcw, Building2 } from 'lucide-react';
import { formatCurrencyBRL } from '../utils/financial';
import { EditalAnalysisModal } from './EditalAnalysisModal';
import { PropertyMap } from './PropertyMap';

interface PropertyDiscoveryProps {
  properties: Property[];
  selectedProperty?: Property;
  onSelectProperty: (property: Property) => void;
  onOpenMaxBid: (property: Property) => void;
  viewMode: 'grid' | 'map' | 'split';
  activeMapLayer: 'default' | 'price' | 'flood' | 'safety' | 'noise' | '3d';
  setActiveMapLayer: (layer: 'default' | 'price' | 'flood' | 'safety' | 'noise' | '3d') => void;
}

export const PropertyDiscovery: React.FC<PropertyDiscoveryProps> = ({
  properties,
  selectedProperty,
  onSelectProperty,
  onOpenMaxBid,
  viewMode,
  activeMapLayer,
  setActiveMapLayer,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBank, setSelectedBank] = useState<string>('Todas');
  const [selectedState, setSelectedState] = useState<string>('Todos');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [selectedAcquisition, setSelectedAcquisition] = useState<string>('Todas');
  const [selectedOccupancy, setSelectedOccupancy] = useState<string>('Todos');
  const [onlyFinancable, setOnlyFinancable] = useState(false);
  const [minDiscount, setMinDiscount] = useState<number>(0);
  const [selectedEditalProperty, setSelectedEditalProperty] = useState<Property | null>(null);

  // Lista dinâmica de cidades únicas da base atual
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    properties.forEach(p => {
      if (p.address?.city) set.add(p.address.city);
    });
    return Array.from(set).sort();
  }, [properties]);

  // Lista dinâmica de estados únicos
  const availableStates = useMemo(() => {
    const set = new Set<string>();
    properties.forEach(p => {
      if (p.address?.state) set.add(p.address.state);
    });
    return Array.from(set).sort();
  }, [properties]);

  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      const text = `${p.title} ${p.address.city} ${p.address.neighborhood} ${p.address.street} ${p.bankName}`.toLowerCase();
      const matchesSearch = !searchTerm || text.includes(searchTerm.toLowerCase());

      const bankName = (p.bankName || p.originBank || '').toUpperCase();
      const matchesBank = selectedBank === 'Todas' 
        || (selectedBank === 'CAIXA' && bankName.includes('CAIXA'))
        || (selectedBank === 'SANTANDER' && bankName.includes('SANTANDER'))
        || (selectedBank === 'BRADESCO' && bankName.includes('BRADESCO'));

      const matchesState = selectedState === 'Todos' || p.address.state === selectedState;
      const matchesCity = !selectedCity || p.address.city.toLowerCase().includes(selectedCity.toLowerCase());
      const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
      const matchesAcquisition = selectedAcquisition === 'Todas' || p.acquisitionType === selectedAcquisition;
      const matchesOccupancy = selectedOccupancy === 'Todos' || p.occupancyStatus === selectedOccupancy;
      const matchesFinancable = !onlyFinancable || p.isFinancable;
      const matchesDiscount = (p.apparentDiscountPercentage || 0) >= minDiscount;

      return matchesSearch && matchesBank && matchesState && matchesCity && matchesCategory && matchesAcquisition && matchesOccupancy && matchesFinancable && matchesDiscount;
    });
  }, [
    properties,
    searchTerm,
    selectedBank,
    selectedState,
    selectedCity,
    selectedCategory,
    selectedAcquisition,
    selectedOccupancy,
    onlyFinancable,
    minDiscount,
  ]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedBank('Todas');
    setSelectedState('Todos');
    setSelectedCity('');
    setSelectedCategory('Todos');
    setSelectedAcquisition('Todas');
    setSelectedOccupancy('Todos');
    setOnlyFinancable(false);
    setMinDiscount(0);
  };

  const hasActiveFilter = Boolean(
    searchTerm || selectedBank !== 'Todas' || selectedState !== 'Todos' || selectedCity || selectedCategory !== 'Todos' || selectedAcquisition !== 'Todas' || selectedOccupancy !== 'Todos' || onlyFinancable || minDiscount > 0
  );

  return (
    <div className="space-y-6">
      
      {/* Banner de Destaque Leilões de Banco */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 rounded-3xl border border-slate-700/80 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 font-black text-xl">
            🏦
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="bg-orange-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider">
                Multi-Bancos Oficial
              </span>
              <span className="text-xs font-bold text-slate-300">CAIXA • Santander • Bradesco</span>
            </div>
            <h2 className="text-base font-extrabold text-white mt-0.5">
              Mapa e Descoberta Inteligente de Oportunidades
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
          <ShieldCheck className="w-4 h-4" />
          <span>{filteredProperties.length.toLocaleString()} imóveis disponíveis para análise</span>
        </div>
      </div>

      {/* BARRA DE FILTROS AVANÇADOS (LOCALIZADA ACIMA DO MAPA) */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 space-y-4">
        
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-orange-500" />
            <span className="font-black text-xs uppercase tracking-wider text-slate-800">
              Filtros de Foco no Mapa & Oportunidades
            </span>
          </div>
          {hasActiveFilter && (
            <button
              onClick={handleClearFilters}
              className="text-xs text-orange-600 hover:text-orange-700 font-bold flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Limpar Filtros
            </button>
          )}
        </div>

        {/* Linha 1 de Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Busca por Texto */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Busque por bairro, rua ou título..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Banco de Origem */}
          <select
            value={selectedBank}
            onChange={(e) => setSelectedBank(e.target.value)}
            className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 text-xs font-black text-orange-950 focus:ring-2 focus:ring-orange-500"
          >
            <option value="Todas">🏦 Todos os Bancos</option>
            <option value="CAIXA">🏦 Caixa Econômica (CEF)</option>
            <option value="SANTANDER">🏦 Banco Santander</option>
            <option value="BRADESCO">🏦 Banco Bradesco</option>
          </select>

          {/* Estado UF */}
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-orange-500"
          >
            <option value="Todos">Todos os Estados</option>
            {availableStates.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>

          {/* Cidade com Input / Datalist */}
          <div className="relative">
            <input
              type="text"
              placeholder={selectedCity ? selectedCity : "Filtrar por Cidade..."}
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-orange-500"
              list="discovery-cities-datalist"
            />
            <datalist id="discovery-cities-datalist">
              {availableCities.map(city => (
                <option key={city} value={city} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Linha 2 de Filtros Avançados */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Categoria */}
            <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-slate-400 font-bold">Tipo:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent font-bold text-slate-700 focus:outline-none"
              >
                <option value="Todos">Todos os Tipos</option>
                <option value="Apartamento">Apartamento</option>
                <option value="Casa">Casa</option>
                <option value="Comercial">Comercial</option>
                <option value="Terreno">Terreno</option>
              </select>
            </div>

            {/* Modalidade */}
            <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-slate-400 font-bold">Modalidade:</span>
              <select
                value={selectedAcquisition}
                onChange={(e) => setSelectedAcquisition(e.target.value)}
                className="bg-transparent font-bold text-slate-700 focus:outline-none"
              >
                <option value="Todas">Todas</option>
                <option value="Leilão Extrajudicial">Leilão Extrajudicial</option>
                <option value="Venda Direta Banco">Venda Direta Banco</option>
                <option value="Leilão Judicial">Leilão Judicial</option>
              </select>
            </div>

            {/* Ocupação */}
            <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-slate-400 font-bold">Ocupação:</span>
              <select
                value={selectedOccupancy}
                onChange={(e) => setSelectedOccupancy(e.target.value)}
                className="bg-transparent font-bold text-slate-700 focus:outline-none"
              >
                <option value="Todos">Todos</option>
                <option value="Desocupado">Desocupado</option>
                <option value="Ocupado">Ocupado</option>
              </select>
            </div>

            {/* Desconto Mínimo */}
            <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-slate-400 font-bold">Desc. Mín:</span>
              <input
                type="range"
                min="0"
                max="70"
                step="5"
                value={minDiscount}
                onChange={(e) => setMinDiscount(Number(e.target.value))}
                className="w-20 accent-orange-500"
              />
              <span className="font-black text-orange-600">{minDiscount}%</span>
            </div>
          </div>

          <div className="text-slate-500 font-bold">
            Mostrando <strong>{filteredProperties.length}</strong> de {properties.length} imóveis
          </div>
        </div>
      </div>

      {/* MAPA (EXIBIDO LOGO ABAIXO DOS FILTROS SE O MODO FOR MAP OU SPLIT) */}
      {(viewMode === 'split' || viewMode === 'map') && (
        <PropertyMap
          properties={filteredProperties}
          selectedProperty={selectedProperty}
          onSelectProperty={onSelectProperty}
          activeLayer={activeMapLayer}
          setActiveLayer={setActiveMapLayer}
        />
      )}

      {/* GRID DE CARDS (EXIBIDO SE O MODO FOR SPLIT OU GRID) */}
      {(viewMode === 'split' || viewMode === 'grid') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm uppercase tracking-wider text-slate-700">
              Oportunidades Filtradas ({filteredProperties.length})
            </h3>
          </div>

          {filteredProperties.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
              <h4 className="font-black text-slate-700">Nenhum imóvel corresponde aos filtros selecionados</h4>
              <p className="text-xs text-slate-500">Tente reduzir o desconto mínimo ou limpar os filtros para ver toda a base.</p>
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 bg-orange-600 text-white font-bold text-xs rounded-xl"
              >
                Limpar Filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProperties.slice(0, 48).map((property) => (
                <div
                  key={property.id}
                  className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    {/* Imagem do Imóvel com Fallback */}
                    <div className="relative h-48 w-full bg-slate-900 overflow-hidden">
                      <img
                        src={property.images[0] || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80'}
                        alt={property.title}
                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80';
                        }}
                      />

                      {/* Badge Desconto */}
                      <div className="absolute top-3 left-3 bg-red-600 text-white font-black text-xs px-3 py-1 rounded-full shadow-md">
                        -{property.apparentDiscountPercentage}% de Desconto
                      </div>

                      {/* Badge Banco de Origem */}
                      <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-xs text-white text-[10px] font-black px-2.5 py-1 rounded-lg">
                        🏦 {property.bankName || property.originBank || 'CAIXA'}
                      </div>
                    </div>

                    {/* Conteúdo do Card */}
                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <span>{property.acquisitionType}</span>
                        <span className={property.occupancyStatus === 'Desocupado' ? 'text-emerald-600' : 'text-slate-500'}>
                          {property.occupancyStatus}
                        </span>
                      </div>

                      <h3 className="font-black text-sm text-slate-900 leading-tight line-clamp-2">
                        {property.title}
                      </h3>

                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{property.address.street}, {property.address.city}/{property.address.state}</span>
                      </p>

                      {/* Valores */}
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Lance Mínimo</span>
                          <span className="font-black text-emerald-700 text-base">{formatCurrencyBRL(property.secondAuctionPrice)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Avaliado em</span>
                          <span className="text-xs font-bold text-slate-500 line-through">{formatCurrencyBRL(property.appraisalValue)}</span>
                        </div>
                      </div>

                      {/* Características */}
                      <div className="grid grid-cols-3 gap-1 text-center text-[10px] font-bold text-slate-600 bg-slate-50 py-1.5 rounded-xl border border-slate-100">
                        <div>📐 {property.area}m²</div>
                        <div>🛏️ {property.bedrooms} qts</div>
                        <div>🚗 {property.parkingSpaces} vg</div>
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="p-5 pt-0 flex gap-2">
                    <button
                      onClick={() => onSelectProperty(property)}
                      className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1"
                    >
                      <span>Ficha 360°</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onOpenMaxBid(property)}
                      className="bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 font-bold text-xs p-2.5 rounded-xl transition-colors"
                      title="Calcular Lance Máximo"
                    >
                      <Calculator className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Análise de Edital */}
      {selectedEditalProperty && (
        <EditalAnalysisModal
          property={selectedEditalProperty}
          onClose={() => setSelectedEditalProperty(null)}
        />
      )}
    </div>
  );
};
