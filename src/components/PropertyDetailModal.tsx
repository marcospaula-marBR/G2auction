import React, { useState } from 'react';
import type { Property } from '../types/auction';
import { generateScenarios, formatCurrencyBRL } from '../utils/financial';
import { X, ShieldCheck, Printer, Calculator, Info, ExternalLink, Droplets, Volume2 } from 'lucide-react';

interface PropertyDetailModalProps {
  property: Property;
  onClose: () => void;
  onOpenMaxBid: (property: Property) => void;
  onOpenReport: (property: Property) => void;
}

export const PropertyDetailModal: React.FC<PropertyDetailModalProps> = ({
  property,
  onClose,
  onOpenMaxBid,
  onOpenReport,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'comparables' | 'legal' | 'geo' | 'scenarios'>('overview');
  const scenarios = generateScenarios(property);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[92vh]">
        
        {/* Modal Topbar */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 font-extrabold text-xs">
              360°
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-orange-500 text-white px-2 py-0.5 rounded-md">
                  {property.code}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-700 text-slate-200 px-2 py-0.5 rounded-md">
                  {property.acquisitionType}
                </span>
              </div>
              <h2 className="font-extrabold text-base sm:text-lg text-white leading-tight mt-0.5">{property.title}</h2>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-2 flex space-x-2 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'overview' ? 'bg-white text-orange-600 shadow-2xs' : 'text-slate-600 hover:bg-white/50'
            }`}
          >
            Resumo & Scores
          </button>
          <button
            onClick={() => setActiveTab('comparables')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'comparables' ? 'bg-white text-orange-600 shadow-2xs' : 'text-slate-600 hover:bg-white/50'
            }`}
          >
            Comparáveis & Preço/m²
          </button>
          <button
            onClick={() => setActiveTab('legal')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'legal' ? 'bg-white text-orange-600 shadow-2xs' : 'text-slate-600 hover:bg-white/50'
            }`}
          >
            Diligência Jurídica & Antifraude
          </button>
          <button
            onClick={() => setActiveTab('geo')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'geo' ? 'bg-white text-orange-600 shadow-2xs' : 'text-slate-600 hover:bg-white/50'
            }`}
          >
            Geointeligência & Riscos
          </button>
          <button
            onClick={() => setActiveTab('scenarios')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'scenarios' ? 'bg-white text-orange-600 shadow-2xs' : 'text-slate-600 hover:bg-white/50'
            }`}
          >
            Simulador de Cenários & DRE
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">
          
          {/* TAB 1: OVERVIEW & SCORES */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Card Destaque de Preço e Deságio */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 block mb-1">
                    Deságio Aparente de {property.apparentDiscountPercentage}%
                  </span>
                  <div className="text-3xl font-black text-emerald-400">
                    {formatCurrencyBRL(property.secondAuctionPrice)}
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Valor de Avaliação Oficial: <span className="line-through">{formatCurrencyBRL(property.appraisalValue)}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="bg-white/10 px-4 py-2 rounded-2xl border border-white/10 text-center">
                    <span className="text-[9px] text-slate-300 font-bold uppercase block">Preço Aquisição/m²</span>
                    <span className="font-extrabold text-sm text-white">{formatCurrencyBRL(property.acquisitionPricePerM2)}/m²</span>
                  </div>
                  <div className="bg-white/10 px-4 py-2 rounded-2xl border border-white/10 text-center">
                    <span className="text-[9px] text-slate-300 font-bold uppercase block">Preço Mercado/m²</span>
                    <span className="font-extrabold text-sm text-emerald-300">{formatCurrencyBRL(property.estimatedMarketPricePerM2)}/m²</span>
                  </div>
                </div>
              </div>

              {/* Matriz de Scores */}
              <div>
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3">Matriz Multidimensionais de Scores G2:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center">
                  
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase block">Oportunidade</span>
                    <span className="text-lg font-black text-emerald-600">{property.opportunityScore}/10</span>
                  </div>

                  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase block">Liquidez</span>
                    <span className="text-lg font-black text-sky-600">{property.liquidityScore}/10</span>
                  </div>

                  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase block">Localização</span>
                    <span className="text-lg font-black text-orange-600">{property.locationScore}/10</span>
                  </div>

                  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase block">Risco Geral</span>
                    <span className="text-lg font-black text-amber-600">{property.riskScore}/10</span>
                  </div>

                  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase block">Complex. Jurídica</span>
                    <span className="text-lg font-black text-slate-800">{property.legalComplexityScore}/10</span>
                  </div>

                  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase block">Est. Reforma</span>
                    <span className="text-sm font-black text-slate-900">{formatCurrencyBRL(property.renovationEstimate)}</span>
                  </div>

                </div>
              </div>

              {/* Especificações Físicas */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Características do Imóvel:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium text-slate-700">
                  <div>• Área Total: <span className="font-bold text-slate-900">{property.area} m²</span></div>
                  <div>• Dormitórios: <span className="font-bold text-slate-900">{property.bedrooms} suítes</span></div>
                  <div>• Banheiros: <span className="font-bold text-slate-900">{property.bathrooms}</span></div>
                  <div>• Vagas de Garagem: <span className="font-bold text-slate-900">{property.parkingSpaces} vagas</span></div>
                </div>
                <p className="text-xs text-slate-600 pt-2 border-t border-slate-100 leading-relaxed">
                  {property.description}
                </p>
              </div>

            </div>
          )}

          {/* TAB 2: COMPARABLES & PRICE PER M2 */}
          {activeTab === 'comparables' && (
            <div className="space-y-6">
              
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-extrabold text-sm text-slate-900">Motor de Comparáveis de Mercado (Amostragem Raio 500m)</h3>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200">
                    Fonte: Anúncios Ativos de Portais Integrados
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/60 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Imóvel Comparável</th>
                        <th className="py-2.5 px-3">Área</th>
                        <th className="py-2.5 px-3">Distância</th>
                        <th className="py-2.5 px-3">Preço Anunciado</th>
                        <th className="py-2.5 px-3">Preço/m²</th>
                        <th className="py-2.5 px-3">Fonte</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {property.comparables.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{c.title}</td>
                          <td className="py-2.5 px-3">{c.area} m²</td>
                          <td className="py-2.5 px-3">{c.distanceMeters} metros</td>
                          <td className="py-2.5 px-3 font-bold">{formatCurrencyBRL(c.price)}</td>
                          <td className="py-2.5 px-3 font-extrabold text-emerald-700">{formatCurrencyBRL(c.pricePerM2)}/m²</td>
                          <td className="py-2.5 px-3 text-slate-400 font-medium">{c.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Explicação da Metodologia de Preço/m² */}
              <div className="bg-orange-50 p-4 rounded-2xl border border-orange-200 text-xs text-orange-950 space-y-1">
                <h4 className="font-extrabold flex items-center gap-1">
                  <Info className="w-4 h-4 text-orange-600" /> Transparência de Preço de Anúncio vs Preço Transacionado Real:
                </h4>
                <p className="leading-relaxed text-[11px] text-orange-900">
                  Valores de anúncios contêm margem média de negociação de 5% a 8%. O G2 AUCTION aplica ajuste estatístico determinístico no preço médio do metro quadrado antes de sugerir a estimativa final de revenda.
                </p>
              </div>

            </div>
          )}

          {/* TAB 3: LEGAL DUE DILIGENCE & ANTIFRAUD */}
          {activeTab === 'legal' && (
            <div className="space-y-6">
              
              {/* Card de Antifraude */}
              <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-3xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-emerald-950">Leiloeiro Oficial Verificado (Soma Zero Antifraude)</h3>
                    <p className="text-xs text-emerald-800 font-medium">Plataforma homologada: {property.auctioneerName} ({property.auctioneerSite})</p>
                  </div>
                </div>
                <span className="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-2xs">
                  Selo Antifraude Valido
                </span>
              </div>

              {/* Checklist de Diligência Jurídica */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Checklist Automatizado de Diligência:</h4>
                
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="font-bold">• Edital de Leilão:</span>
                    <a href={property.editalUrl} target="_blank" rel="noreferrer" className="text-orange-600 font-bold flex items-center gap-1 hover:underline">
                      Ver Edital Completo PDF <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="font-bold">• Certidão de Matrícula de Imóveis:</span>
                    <a href={property.matriculaUrl} target="_blank" rel="noreferrer" className="text-orange-600 font-bold flex items-center gap-1 hover:underline">
                      Ver Matrícula Atualizada <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="font-bold">• Responsabilidade por Débitos de Condomínio/IPTU:</span>
                    <span className={`font-bold px-2 py-0.5 rounded-md ${
                      property.debts.isBuyerResponsible ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                    }`}>
                      {property.debts.isBuyerResponsible ? 'Arrematante Assume Passivo' : 'Sub-rogado no Preço da Arrematação'}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: GEOINTELLIGENCE & RISKS */}
          {activeTab === 'geo' && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Segurança */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-600 font-extrabold text-xs">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Segurança Pública</span>
                  </div>
                  <h4 className="font-black text-slate-900 text-base">{property.safetyIndex.level}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{property.safetyIndex.summary}</p>
                </div>

                {/* Enchente */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center space-x-2 text-sky-600 font-extrabold text-xs">
                    <Droplets className="w-4 h-4" />
                    <span>Risco Hidrológico</span>
                  </div>
                  <h4 className="font-black text-slate-900 text-base">Risco {property.floodRisk.level}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{property.floodRisk.summary}</p>
                </div>

                {/* Ruído */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center space-x-2 text-amber-600 font-extrabold text-xs">
                    <Volume2 className="w-4 h-4" />
                    <span>Densidade de Ruído</span>
                  </div>
                  <h4 className="font-black text-slate-900 text-base">{property.noiseIndex.level}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{property.noiseIndex.summary}</p>
                </div>

              </div>

            </div>
          )}

          {/* TAB 5: SCENARIOS & DRE OPERACIONAL */}
          {activeTab === 'scenarios' && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {scenarios.map((sc) => (
                  <div
                    key={sc.name}
                    className={`p-5 rounded-3xl border flex flex-col justify-between space-y-4 ${
                      sc.name === 'Base' ? 'bg-orange-50/60 border-orange-300 shadow-sm' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div>
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${
                        sc.name === 'Base' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}>
                        Cenário {sc.name}
                      </span>

                      <div className="mt-3 space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Lucro Líquido Projetado</span>
                        <span className="text-2xl font-black text-slate-900">{formatCurrencyBRL(sc.netProfit)}</span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs pt-3 border-t border-slate-200/60 font-semibold">
                      <div className="flex justify-between">
                        <span>Preço de Venda:</span>
                        <span>{formatCurrencyBRL(sc.salePrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tempo de Perm.:</span>
                        <span>{sc.holdingTimeMonths} meses</span>
                      </div>
                      <div className="flex justify-between">
                        <span>ROI Estimado:</span>
                        <span className="font-bold text-emerald-600">+{sc.roi}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>TIR Anual:</span>
                        <span className="font-extrabold text-emerald-700">+{sc.irrAnnual}% a.a.</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

        </div>

        {/* Modal Bottom Bar Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => onOpenReport(property)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center space-x-1.5"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Gerar Relatório PDF de Inteligência</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                onClose();
                onOpenMaxBid(property);
              }}
              className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <Calculator className="w-4 h-4" />
              <span>Calcular Lance Máximo</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
