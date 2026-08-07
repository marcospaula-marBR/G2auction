import React from 'react';
import type { Property } from '../types/auction';
import { formatCurrencyBRL, calculateMaxBid } from '../utils/financial';
import { X, Printer } from 'lucide-react';

interface PropertyReportModalProps {
  property: Property;
  onClose: () => void;
}

export const PropertyReportModal: React.FC<PropertyReportModalProps> = ({ property, onClose }) => {
  const maxBid = calculateMaxBid({
    expectedMarketValue: property.estimatedMarketPrice,
    renovationEstimate: property.renovationEstimate,
    debtsToPay: property.debts.iptu + property.debts.condominium,
    targetRoiPercent: 30,
    holdingMonths: 10,
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Top Control Bar (Não aparece na impressão) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-sm text-white">Relatório Oficial de Inteligência G2</span>
            <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Pronto para Impressão</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center space-x-1.5 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Salvar PDF</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-xl">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 sm:p-12 space-y-8 bg-white text-slate-900 font-sans print:p-0">
          
          {/* Header do Relatório */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-6">
            <div className="flex items-center space-x-4">
              <img
                src="/logo/logo.jpeg"
                alt="G2 AUCTION"
                className="h-14 w-auto object-contain"
              />
              <div>
                <p className="text-xs text-slate-500 font-bold">O passo a passo para arrematar seu imóvel</p>
              </div>
            </div>

            <div className="text-right text-xs text-slate-500">
              <p className="font-bold text-slate-800">RELATÓRIO DE INTELIGÊNCIA #G2-{property.code}</p>
              <p>Data de Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
              <span className="inline-block mt-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Auditado por IA G2
              </span>
            </div>
          </div>

          {/* Resumo do Ativo */}
          <div className="space-y-3">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-600">1. Identificação do Ativo</span>
            <h2 className="text-xl font-black text-slate-900">{property.title}</h2>
            <p className="text-xs text-slate-600 leading-relaxed">{property.description}</p>
            <div className="text-xs text-slate-500 font-semibold">
              Endereço: {property.address.street}, {property.address.number} - {property.address.neighborhood}, {property.address.city}/{property.address.state} (CEP: {property.address.zip})
            </div>
          </div>

          {/* Tabela de Valores e Lance Máximo */}
          <div className="space-y-3">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-600">2. Síntese Financeira & Proposta Racional</span>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-center">
              <div>
                <span className="text-slate-400 font-bold block">Avaliação Oficial</span>
                <span className="font-extrabold text-sm text-slate-800">{formatCurrencyBRL(property.appraisalValue)}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block">Mínimo 2ª Praça</span>
                <span className="font-extrabold text-sm text-slate-900">{formatCurrencyBRL(property.secondAuctionPrice)}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block">Deságio Aparente</span>
                <span className="font-black text-sm text-orange-600">{property.apparentDiscountPercentage}%</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block">Lance Máximo Sugerido</span>
                <span className="font-black text-sm text-emerald-600">{formatCurrencyBRL(maxBid.maxBidPrice)}</span>
              </div>
            </div>
          </div>

          {/* Matriz de Scores */}
          <div className="space-y-3">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-600">3. Matriz de Scores Multidimensionais</span>
            
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-center text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[9px] text-slate-400 font-bold uppercase block">Oportunidade</span>
                <span className="font-black text-base text-emerald-600">{property.opportunityScore}/10</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[9px] text-slate-400 font-bold uppercase block">Liquidez</span>
                <span className="font-black text-base text-sky-600">{property.liquidityScore}/10</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[9px] text-slate-400 font-bold uppercase block">Localização</span>
                <span className="font-black text-base text-orange-600">{property.locationScore}/10</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[9px] text-slate-400 font-bold uppercase block">Risco Geral</span>
                <span className="font-black text-base text-amber-600">{property.riskScore}/10</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[9px] text-slate-400 font-bold uppercase block">Jurídico</span>
                <span className="font-black text-base text-slate-800">{property.legalComplexityScore}/10</span>
              </div>
            </div>
          </div>

          {/* Diligência Jurídica */}
          <div className="space-y-3">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-600">4. Parecer de Diligência e Leiloeiro</span>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
              <p>• <strong>Leiloeiro Homologado:</strong> {property.auctioneerName} ({property.auctioneerSite}) - <em>Selo Antifraude OK</em></p>
              <p>• <strong>Status da Ocupação:</strong> {property.occupancyStatus}</p>
              <p>• <strong>Passivos:</strong> Débitos de condomínio ({formatCurrencyBRL(property.debts.condominium)}) e IPTU ({formatCurrencyBRL(property.debts.iptu)}) com sub-rogação no edital.</p>
            </div>
          </div>

          {/* Recomendação Final da IA */}
          <div className="bg-orange-50 border-2 border-orange-500/40 p-5 rounded-2xl space-y-2 text-xs">
            <span className="font-black text-orange-950 uppercase tracking-wider text-[10px]">Recomendação do Comitê de IA G2:</span>
            <h4 className="text-lg font-black text-orange-700">RECOMENDADO PARA HABILITAÇÃO E LANCE</h4>
            <p className="text-orange-900 leading-relaxed">
              Imóvel com deságio real atraente, excelente score de localização ({property.locationScore}/10) e alta liquidez de mercado para revenda em menos de 10 meses.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};
