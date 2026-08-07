import React, { useState } from 'react';
import type { Property } from '../types/auction';
import { calculateMaxBid, formatCurrencyBRL } from '../utils/financial';
import { Calculator, X, Sparkles } from 'lucide-react';

interface MaxBidCalculatorProps {
  property: Property;
  onClose: () => void;
}

export const MaxBidCalculator: React.FC<MaxBidCalculatorProps> = ({ property, onClose }) => {
  const [targetRoi, setTargetRoi] = useState<number>(30);
  const [holdingMonths, setHoldingMonths] = useState<number>(10);
  const [renovationCost, setRenovationCost] = useState<number>(property.renovationEstimate);
  const [debtsToPay, setDebtsToPay] = useState<number>(property.debts.iptu + property.debts.condominium);

  const result = calculateMaxBid({
    expectedMarketValue: property.estimatedMarketPrice,
    renovationEstimate: renovationCost,
    debtsToPay: debtsToPay,
    targetRoiPercent: targetRoi,
    holdingMonths: holdingMonths,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-white">Motor do Lance Máximo Racional</h3>
              <p className="text-xs text-slate-300 truncate max-w-sm">{property.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Sliders de Parâmetros */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            
            {/* Target ROI Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-extrabold text-slate-700">ROI Alvo Desejado:</label>
                <span className="text-sm font-black text-orange-600">{targetRoi}%</span>
              </div>
              <input
                type="range"
                min="15"
                max="60"
                step="5"
                value={targetRoi}
                onChange={(e) => setTargetRoi(Number(e.target.value))}
                className="w-full accent-orange-500 cursor-pointer"
              />
            </div>

            {/* Holding Time Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-extrabold text-slate-700">Prazo Estimado de Permanência:</label>
                <span className="text-sm font-black text-slate-800">{holdingMonths} meses</span>
              </div>
              <input
                type="range"
                min="3"
                max="24"
                step="1"
                value={holdingMonths}
                onChange={(e) => setHoldingMonths(Number(e.target.value))}
                className="w-full accent-slate-800 cursor-pointer"
              />
            </div>

            {/* Custo Reforma Input */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Estimativa de Reforma (R$):</label>
                <input
                  type="number"
                  value={renovationCost}
                  onChange={(e) => setRenovationCost(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Débitos a Quitar (R$):</label>
                <input
                  type="number"
                  value={debtsToPay}
                  onChange={(e) => setDebtsToPay(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                />
              </div>
            </div>

          </div>

          {/* Card de Resultado do Lance Máximo */}
          <div className="bg-gradient-to-br from-orange-500 to-red-600 text-white p-5 rounded-3xl shadow-lg space-y-3">
            <div className="flex items-center justify-between text-xs text-orange-100 font-bold uppercase tracking-wider">
              <span>Lance Máximo Recomendado (Limite)</span>
              <Sparkles className="w-4 h-4" />
            </div>

            <div className="text-3xl font-black tracking-tight">
              {formatCurrencyBRL(result.maxBidPrice)}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/20 text-xs font-medium">
              <div>
                <span className="opacity-80 block text-[10px] uppercase">Desembolso Total Esperado:</span>
                <span className="font-extrabold text-sm">{formatCurrencyBRL(result.totalInvestment)}</span>
              </div>
              <div>
                <span className="opacity-80 block text-[10px] uppercase">Lucro Líquido Projetado:</span>
                <span className="font-extrabold text-sm text-emerald-200">{formatCurrencyBRL(result.expectedNetProfit)}</span>
              </div>
            </div>

            <div className="bg-black/20 p-2.5 rounded-xl flex justify-between items-center text-xs font-bold">
              <span>TIR Anualizada Determinística:</span>
              <span className="text-emerald-300 font-black text-sm">+{result.actualIrrAnnual}% a.a.</span>
            </div>
          </div>

          {/* Detalhamento dos Custos / Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Detalhamento dos Desembolsos:</h4>
            
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>Valor de Arrematação (Lance):</span>
                <span className="font-bold">{formatCurrencyBRL(result.breakdown.bidPrice)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Comissão Leiloeiro (5%):</span>
                <span className="font-bold">{formatCurrencyBRL(result.breakdown.auctioneerFee)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>ITBI + Escritura/Cartório (4%):</span>
                <span className="font-bold">{formatCurrencyBRL(result.breakdown.itbiAndRegistry)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Honorários Advocatícios & Legal:</span>
                <span className="font-bold">{formatCurrencyBRL(result.breakdown.legalCosts)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Manutenção & Manuseio ({holdingMonths}m):</span>
                <span className="font-bold">{formatCurrencyBRL(result.breakdown.holdingCosts)}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs"
          >
            Aplicar no Lance
          </button>
        </div>

      </div>
    </div>
  );
};
