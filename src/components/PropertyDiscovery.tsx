import React, { useState } from 'react';
import type { Property } from '../types/auction';
import { Search, ShieldCheck, MapPin, Sparkles, ChevronRight, Calculator } from 'lucide-react';
import { formatCurrencyBRL } from '../utils/financial';

interface PropertyDiscoveryProps {
  properties: Property[];
  onSelectProperty: (property: Property) => void;
  onOpenMaxBid: (property: Property) => void;
}

export const PropertyDiscovery: React.FC<PropertyDiscoveryProps> = ({
  properties,
  onSelectProperty,
  onOpenMaxBid,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('Todas');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [selectedAcquisition, setSelectedAcquisition] = useState<string>('Todas');
  const [selectedOccupancy, setSelectedOccupancy] = useState<string>('Todos');
  const [onlyFinancable, setOnlyFinancable] = useState(false);
  const [minDiscount, setMinDiscount] = useState<number>(0);

  const filteredProperties = properties.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.address.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.address.neighborhood.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCity = selectedCity === 'Todas' || p.address.city === selectedCity;
    const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
    const matchesAcquisition = selectedAcquisition === 'Todas' || p.acquisitionType === selectedAcquisition;
    const matchesOccupancy = selectedOccupancy === 'Todos' || p.occupancyStatus === selectedOccupancy;
    const matchesFinancable = !onlyFinancable || p.isFinancable;
    const matchesDiscount = p.apparentDiscountPercentage >= minDiscount;

    return matchesSearch && matchesCity && matchesCategory && matchesAcquisition && matchesOccupancy && matchesFinancable && matchesDiscount;
  });

  return (
    <div className="space-y-6">
      
      {/* Barra de Filtros Avançados */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 space-y-4">
        
        <div className="flex flex-col md:flex-row gap-3">
          {/* Busca por Texto / Linguagem Natural */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Busque por cidade, bairro, condomínio ou edital (Ex: Cambuí, 30% deságio)"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium text-slate-800"
            />
          </div>

          {/* Seletor Cidade */}
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="Todas">Todas as Cidades</option>
            <option value="Campinas">Campinas (SP)</option>
            <option value="São Paulo">São Paulo (SP)</option>
            <option value="Santos">Santos (SP)</option>
          </select>

          {/* Seletor Categoria */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="Todos">Todos os Tipos</option>
            <option value="Apartamento">Apartamento</option>
            <option value="Casa">Casa em Condomínio</option>
            <option value="Comercial">Comercial</option>
          </select>
        </div>

        {/* Linha Secundária de Filtros Avançados */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100 text-xs">
          
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Modalidade */}
            <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-slate-400 font-bold">Modalidade:</span>
              <select
                value={selectedAcquisition}
                onChange={(e) => setSelectedAcquisition(e.target.value)}
                className="bg-transparent font-bold text-slate-700 focus:outline-none"
              >
                <option value="Todas">Todas</option>
                <option value="Leilão Extrajudicial">Extrajudicial</option>
                <option value="Leilão Judicial">Judicial</option>
                <option value="Venda Direta Banco">Venda Direta Banco</option>
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
                <option value="Ocupado">Ocupado</option>
                <option value="Desocupado">Desocupado</option>
              </select>
            </div>

            {/* Aceita Financiamento Toggle */}
            <label className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 font-bold text-slate-700">
              <input
                type="checkbox"
                checked={onlyFinancable}
                onChange={(e) => setOnlyFinancable(e.target.checked)}
                className="rounded text-orange-500 focus:ring-orange-500"
              />
              <span>Aceita Financiamento Bank</span>
            </label>

          </div>

          {/* Slider Deságio Mínimo */}
          <div className="flex items-center space-x-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="font-bold text-slate-500">Deságio Mínimo:</span>
            <input
              type="range"
              min="0"
              max="50"
              step="5"
              value={minDiscount}
              onChange={(e) => setMinDiscount(Number(e.target.value))}
              className="w-24 accent-orange-500"
            />
            <span className="font-extrabold text-orange-600 w-10 text-right">{minDiscount}%</span>
          </div>

        </div>
      </div>

      {/* Grid de Imóveis */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProperties.map((p) => (
          <div
            key={p.id}
            className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group"
          >
            {/* Foto do Imóvel com Badges Overlaid */}
            <div className="relative h-56 w-full overflow-hidden bg-slate-100">
              <img
                src={p.images[0]}
                alt={p.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              
              {/* Badge Deságio Principal */}
              <div className="absolute top-3 left-3 bg-gradient-to-r from-orange-600 to-red-600 text-white font-black text-xs px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> {p.apparentDiscountPercentage}% DESÁGIO
              </div>

              {/* Badge Modalidade */}
              <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md text-white font-bold text-[10px] px-2.5 py-1 rounded-full border border-white/20">
                {p.acquisitionType}
              </div>

              {/* Ocupação */}
              <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md text-slate-800 font-bold text-[10px] px-2.5 py-1 rounded-lg border border-slate-200">
                Status: {p.occupancyStatus}
              </div>
            </div>

            {/* Informações do Imóvel */}
            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center text-xs font-semibold text-slate-500 space-x-1 mb-1">
                  <MapPin className="w-3.5 h-3.5 text-orange-500" />
                  <span>{p.address.neighborhood}, {p.address.city} - {p.address.state}</span>
                </div>

                <h3 className="font-extrabold text-slate-900 text-base leading-snug line-clamp-2 hover:text-orange-600 transition-colors">
                  {p.title}
                </h3>
              </div>

              {/* Tabela de Preços e Valores */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-500 font-medium">Mínimo 2ª Praça:</span>
                  <span className="text-lg font-black text-emerald-600">{formatCurrencyBRL(p.secondAuctionPrice)}</span>
                </div>
                
                <div className="flex justify-between text-xs text-slate-500 font-medium pt-1 border-t border-slate-200/60">
                  <span>Avaliação Oficial:</span>
                  <span className="line-through">{formatCurrencyBRL(p.appraisalValue)}</span>
                </div>

                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Preço Aquisição/m²:</span>
                  <span className="font-bold">{formatCurrencyBRL(p.acquisitionPricePerM2)}/m²</span>
                </div>
              </div>

              {/* Leiloeiro Verificado */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1 text-slate-600">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold truncate max-w-[170px]">{p.auctioneerName}</span>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Antifraude OK
                </span>
              </div>

              {/* Botões de Ação */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => onOpenMaxBid(p)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-2.5 rounded-xl transition-colors flex items-center justify-center space-x-1"
                >
                  <Calculator className="w-3.5 h-3.5 text-orange-600" />
                  <span>Lance Máximo</span>
                </button>

                <button
                  onClick={() => onSelectProperty(p)}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1"
                >
                  <span>Ficha 360°</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
