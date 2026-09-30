import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  CheckCircle2,
  Percent,
  Scale,
} from 'lucide-react';
import { formatCurrencyBRL } from '../utils/financial';
import {
  getItbiRateForCity,
  ITBI_MUNICIPAL_RATES,
  getIptuPortalLink,
} from '../utils/journeyEngine';
import { PropertyHeaderSummary } from './PropertyHeaderSummary';

interface ItbiCalculatorModalProps {
  property: any;
  winningBidAmount?: number;
  onClose: () => void;
  onSaveItbi: (data: { calculatedItbi: number; rate: number; baseValue: number }) => void;
}

export const ItbiCalculatorModal: React.FC<ItbiCalculatorModalProps> = ({
  property,
  winningBidAmount,
  onClose,
  onSaveItbi,
}) => {
  const city = property.address?.city || property.city || 'São Paulo';
  const state = property.address?.state || property.state || 'SP';
  const defaultRateInfo = getItbiRateForCity(city);

  const basePrice = winningBidAmount || Number(property.secondAuctionPrice || property.sale_value || 300000);
  const appraisalVal = Number(property.appraisal_value || property.appraisalValue || basePrice * 1.5);

  const [selectedCityKey, setSelectedCityKey] = useState<string>(
    ITBI_MUNICIPAL_RATES[city.toUpperCase()] ? city.toUpperCase() : 'CUSTOM'
  );
  const [itbiRate, setItbiRate] = useState<number>(defaultRateInfo.rate);
  const [baseValue, setBaseValue] = useState<number>(basePrice);
  const [itbiAmount, setItbiAmount] = useState<number>(Math.round((basePrice * defaultRateInfo.rate) / 100));

  const handleRateChange = (newRate: number) => {
    setItbiRate(newRate);
    setItbiAmount(Math.round((baseValue * newRate) / 100));
  };

  const handleBaseChange = (newBase: number) => {
    setBaseValue(newBase);
    setItbiAmount(Math.round((newBase * itbiRate) / 100));
  };

  const handleAmountChange = (newAmount: number) => {
    setItbiAmount(newAmount);
    if (baseValue > 0) {
      setItbiRate(Number(((newAmount / baseValue) * 100).toFixed(2)));
    }
  };

  const handleSelectCityPreset = (key: string) => {
    setSelectedCityKey(key);
    if (key !== 'CUSTOM' && ITBI_MUNICIPAL_RATES[key]) {
      const rate = ITBI_MUNICIPAL_RATES[key].rate;
      setItbiRate(rate);
      setItbiAmount(Math.round((baseValue * rate) / 100));
    }
  };

  const iptuLink = getIptuPortalLink(city, state);

  const handleSave = () => {
    onSaveItbi({
      calculatedItbi: itbiAmount,
      rate: itbiRate,
      baseValue,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header com Informações do Banco e Resumo do Imóvel */}
        <div className="p-5 bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-950 text-white flex items-start justify-between gap-4 border-b border-blue-900/60">
          <div className="flex-1 pr-2">
            <PropertyHeaderSummary
              property={property}
              contextTitle="Calculadora Oficial de ITBI Municipal"
              contextBadge="Etapa 13 · STJ Tema 1.113"
              showKpis={true}
            />
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Guia STJ Tema 1113 */}
        <div className="p-4 bg-blue-50 border-b border-blue-100 flex items-start gap-3">
          <Scale className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black text-blue-900">
              Jurisprudência Vinculante do STJ (Tema 1.113):
            </p>
            <p className="text-xs text-blue-800 leading-relaxed mt-0.5">
              O Superior Tribunal de Justiça fixou que a base de cálculo do ITBI no leilão é o <strong>valor da arrematação (lance efetivo)</strong>, vedando que a prefeitura cobre sobre "valor venal de referência" arbitrado unilateralmente.
            </p>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50">
          
          {/* Cidade e Tabela */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-extrabold text-slate-700">
                Município de Incidência do Tributo:
              </label>
              <select
                value={selectedCityKey}
                onChange={(e) => handleSelectCityPreset(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none"
              >
                <option value="CUSTOM">Outro Município / Personalizado</option>
                {Object.entries(ITBI_MUNICIPAL_RATES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.name} ({v.rate}%)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              {/* Base de Cálculo */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-extrabold text-slate-700">
                    Base de Cálculo (Lance/Arrematação):
                  </label>
                  <span className="text-[10px] text-slate-400 font-bold">100% Editável</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                    R$
                  </span>
                  <input
                    type="number"
                    value={baseValue}
                    onChange={(e) => handleBaseChange(Number(e.target.value) || 0)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Avaliação de Referência: {formatCurrencyBRL(appraisalVal)}
                </span>
              </div>

              {/* Alíquota Municipal */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-extrabold text-slate-700">
                    Alíquota Municipal (%):
                  </label>
                  <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                    {itbiRate}%
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={itbiRate}
                    onChange={(e) => handleRateChange(Number(e.target.value) || 0)}
                    className="w-full pr-8 pl-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <Percent className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Padrão para {city}: {defaultRateInfo.rate}%
                </span>
              </div>
            </div>
          </div>

          {/* Resultado do ITBI com edição direta em R$ */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-blue-300">
                Guia de ITBI Municipal a Recolher
              </p>
              <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                {formatCurrencyBRL(itbiAmount)}
              </h3>
              <p className="text-xs text-blue-200 mt-1">
                Calculado: {itbiRate}% sobre {formatCurrencyBRL(baseValue)}
              </p>
            </div>

            <div className="bg-white/10 p-3 rounded-xl border border-white/15 w-full sm:w-auto">
              <label className="text-[10px] font-bold text-blue-200 block mb-1">
                Ajustar Valor Exato da Guia (R$):
              </label>
              <input
                type="number"
                value={itbiAmount}
                onChange={(e) => handleAmountChange(Number(e.target.value) || 0)}
                className="w-full sm:w-36 px-3 py-1.5 bg-white text-slate-900 rounded-lg text-sm font-black focus:outline-none"
              />
            </div>
          </div>

          {/* Link para Emissão Oficial */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-slate-800">
                Emissão da Guia no Portal da Prefeitura de {city}:
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Emita a guia com código de barras diretamente pelo sistema municipal.
              </p>
            </div>

            <a
              href={iptuLink.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 flex-shrink-0 shadow-sm"
            >
              <span>Abrir Portal de {city}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancelar
          </button>

          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Salvar ITBI e Concluir Etapa 13</span>
          </button>
        </div>

      </div>
    </div>
  );
};
