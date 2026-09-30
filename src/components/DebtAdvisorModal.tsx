import React, { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Percent,
  X,
} from 'lucide-react';
import { formatCurrencyBRL } from '../utils/financial';
import {
  detectEditalDebtRules,
  getIptuPortalLink,
  adviseCondominiumDebt,
} from '../utils/journeyEngine';

interface DebtAdvisorModalProps {
  property: any;
  currentIptuDebt?: number;
  currentCondoDebt?: number;
  onClose: () => void;
  onSaveDebts: (data: {
    iptuAmount: number;
    condoAmount: number;
    condoPercentage: number;
    condoCalculationMode: 'exact' | 'percentage' | 'ai';
    responsibleParty: 'banco' | 'arrematante';
  }) => void;
}

export const DebtAdvisorModal: React.FC<DebtAdvisorModalProps> = ({
  property,
  currentIptuDebt = 0,
  currentCondoDebt = 0,
  onClose,
  onSaveDebts,
}) => {
  const city = property.address?.city || property.city || 'São Paulo';
  const state = property.address?.state || property.state || 'SP';
  const appraisalVal = Number(property.appraisal_value || property.appraisalValue || property.sale_value || 350000);

  // Análise Automática do Edital
  const editalRules = detectEditalDebtRules(property);
  const condoAdvice = adviseCondominiumDebt(property);
  const iptuPortal = getIptuPortalLink(city, state);

  // Estados dos débitos (100% editáveis pelo usuário)
  const [responsibleParty, setResponsibleParty] = useState<'banco' | 'arrematante'>(
    editalRules.iptuPayer === 'ARREMATANTE' ? 'arrematante' : 'banco'
  );

  const [iptuAmount, setIptuAmount] = useState<number>(currentIptuDebt);
  const [isIptuFreeByBank, setIsIptuFreeByBank] = useState<boolean>(
    responsibleParty === 'banco' && currentIptuDebt === 0
  );

  // Modo de condomínio: 'exact' (valor em R$), 'percentage' (% teto da avaliação), 'ai' (sugerido por IA)
  const [condoMode, setCondoMode] = useState<'exact' | 'percentage' | 'ai'>('ai');
  const [condoPercentage, setCondoPercentage] = useState<number>(condoAdvice.recommendedPercentage);
  const [condoAmount, setCondoAmount] = useState<number>(
    currentCondoDebt > 0 ? currentCondoDebt : condoAdvice.suggestedAmount
  );

  // Ao alterar o percentual livremente
  const handlePercentageChange = (newPct: number) => {
    setCondoPercentage(newPct);
    const newAmt = Math.round((appraisalVal * newPct) / 100);
    setCondoAmount(newAmt);
  };

  // Ao alterar o valor em R$ livremente
  const handleAmountChange = (newAmt: number) => {
    setCondoAmount(newAmt);
    if (appraisalVal > 0) {
      const newPct = Number(((newAmt / appraisalVal) * 100).toFixed(2));
      setCondoPercentage(newPct);
    }
  };

  // Aplicar Preset da IA
  const handleApplyAIPreset = (pct: number, amt: number) => {
    setCondoPercentage(pct);
    setCondoAmount(amt);
    setCondoMode('ai');
  };

  const effectiveIptu = isIptuFreeByBank ? 0 : iptuAmount;
  const effectiveCondo = responsibleParty === 'banco' && isIptuFreeByBank ? 0 : condoAmount;
  const totalDebtsAssumed = responsibleParty === 'arrematante' ? effectiveIptu + effectiveCondo : 0;

  const handleSave = () => {
    onSaveDebts({
      iptuAmount: effectiveIptu,
      condoAmount: effectiveCondo,
      condoPercentage,
      condoCalculationMode: condoMode,
      responsibleParty,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[94vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                  Diagnóstico de Débitos
                </span>
                <span className="text-[10px] font-bold text-slate-300">
                  Avaliação: {formatCurrencyBRL(appraisalVal)}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-0.5">
                Mapeamento de IPTU & Condomínio
              </h2>
              <p className="text-xs text-slate-300 truncate max-w-md">
                {property.title || property.address?.street} — {city}/{state}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner do Edital */}
        <div className={`p-4 border-b ${editalRules.highlightBadge.bg} ${editalRules.highlightBadge.border} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${editalRules.highlightBadge.bg} ${editalRules.highlightBadge.color} border ${editalRules.highlightBadge.border}`}>
                {editalRules.highlightBadge.text}
              </span>
            </div>
            <p className="text-xs text-slate-700 mt-1 leading-snug">
              {editalRules.explanation}
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 flex-shrink-0">
            <span className="text-[11px] font-bold text-slate-600">Quem assume?</span>
            <select
              value={responsibleParty}
              onChange={(e) => setResponsibleParty(e.target.value as any)}
              className="text-xs font-black text-slate-900 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="banco">Banco / Vendedor Quita</option>
              <option value="arrematante">Arrematante Assume Débitos</option>
            </select>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50">
          
          {/* SEÇÃO 1: IPTU */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900">1. Débitos de IPTU (Municipal)</h3>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Consulta 100% Online
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Consulte a certidão de dados cadastrais e extrato de débitos tributários da prefeitura de {city}.
                </p>
              </div>

              <a
                href={iptuPortal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 flex-shrink-0"
              >
                <span>Consultar Portal de {city}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">
                  Débito de IPTU Apurado (R$):
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                    R$
                  </span>
                  <input
                    type="number"
                    value={isIptuFreeByBank ? 0 : iptuAmount}
                    onChange={(e) => {
                      setIsIptuFreeByBank(false);
                      setIptuAmount(Number(e.target.value) || 0);
                    }}
                    placeholder="0,00"
                    disabled={isIptuFreeByBank}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isIptuFreeByBank}
                    onChange={(e) => setIsIptuFreeByBank(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <span>Declarar IPTU como R$ 0 (Banco quita conforme edital)</span>
                </label>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Se o edital determina que o banco paga os débitos tributários até a data da arrematação, marque esta opção.
                </p>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: CONDOMÍNIO (Com % Teto e IA) */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900">2. Débitos Condominiais</h3>
                  <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    {condoAdvice.propertyCategory === 'apartment' ? 'Apartamento' : condoAdvice.propertyCategory === 'house_condo' ? 'Casa em Condomínio' : 'Imóvel Individual'}
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setCondoMode('ai')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                      condoMode === 'ai' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🤖 Sugestão IA
                  </button>
                  <button
                    onClick={() => setCondoMode('percentage')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                      condoMode === 'percentage' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    % Teto
                  </button>
                  <button
                    onClick={() => setCondoMode('exact')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                      condoMode === 'exact' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    R$ Exato
                  </button>
                </div>
              </div>

              {/* Justificativa e Rationale da IA */}
              <div className="mt-3 p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-950 leading-relaxed">
                  <strong>Análise do Robô G2:</strong> {condoAdvice.rationale}
                </p>
              </div>
            </div>

            {/* Presets Rápidos sugeridos pela IA */}
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-2">
                Atalhos Inteligentes de Provisão de Condomínio:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {condoAdvice.presetOptions.map((opt, idx) => {
                  const isSelected = condoPercentage === opt.percentage;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleApplyAIPreset(opt.percentage, opt.amount)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300'
                          : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-slate-900">{opt.label}</span>
                        <span className="text-xs font-black text-amber-700">{opt.percentage}%</span>
                      </div>
                      <p className="text-xs font-bold text-slate-800">
                        {formatCurrencyBRL(opt.amount)}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                        {opt.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Campos de Edição Livre (% e R$) */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* % Teto sobre a avaliação */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-extrabold text-slate-700">
                      % Teto sobre a Avaliação:
                    </label>
                    <span className="text-xs font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      {condoPercentage}% da Avaliação
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="30"
                      value={condoPercentage}
                      onChange={(e) => handlePercentageChange(Number(e.target.value) || 0)}
                      className="w-full pr-8 pl-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <Percent className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    step="0.5"
                    value={condoPercentage}
                    onChange={(e) => handlePercentageChange(Number(e.target.value))}
                    className="w-full mt-2 accent-amber-500 cursor-pointer"
                  />
                </div>

                {/* Valor Calculado em Reais (Também 100% editável) */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-extrabold text-slate-700">
                      Provisão em Reais (R$):
                    </label>
                    <span className="text-[10px] font-bold text-slate-500">
                      Campo 100% livre
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                      R$
                    </span>
                    <input
                      type="number"
                      value={condoAmount}
                      onChange={(e) => handleAmountChange(Number(e.target.value) || 0)}
                      placeholder="0,00"
                      className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 leading-tight">
                    Você pode estipular qualquer valor ou percentual. Ao alterar um, o outro se ajusta em tempo real.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Resumo Consolidado */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                Impacto Financeiro na Arrematação
              </p>
              <h4 className="text-sm font-bold text-white mt-0.5">
                {responsibleParty === 'arrematante'
                  ? 'Débitos assumidos deduzem o Preço-Teto do seu Lance'
                  : 'Débitos quitados pelo Banco (Sem impacto para o arrematante)'}
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                IPTU: {formatCurrencyBRL(effectiveIptu)} · Condomínio: {formatCurrencyBRL(effectiveCondo)} ({condoPercentage}%)
              </p>
            </div>

            <div className="text-right flex-shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total a Provisionar:</span>
              <span className="text-xl font-black text-amber-400">
                {formatCurrencyBRL(totalDebtsAssumed)}
              </span>
            </div>
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
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Salvar Débitos e Aplicar na Jornada</span>
          </button>
        </div>

      </div>
    </div>
  );
};
