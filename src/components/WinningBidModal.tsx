import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Percent,
} from 'lucide-react';
import { formatCurrencyBRL } from '../utils/financial';
import { PropertyHeaderSummary } from './PropertyHeaderSummary';

interface WinningBidModalProps {
  property: any;
  currentBid?: number;
  onClose: () => void;
  onSaveWinningBid: (data: {
    winningBid: number;
    auctioneerCommission: number;
    totalAuctionCost: number;
    auctionDate: string;
  }) => void;
}

export const WinningBidModal: React.FC<WinningBidModalProps> = ({
  property,
  currentBid,
  onClose,
  onSaveWinningBid,
}) => {
  const defaultBid = currentBid || Number(property.secondAuctionPrice || property.sale_value || 300000);
  const [winningBid, setWinningBid] = useState<number>(defaultBid);
  const [commissionPct, setCommissionPct] = useState<number>(5.0);
  const [auctionDate, setAuctionDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const commissionAmount = Math.round((winningBid * commissionPct) / 100);
  const totalCost = winningBid + commissionAmount;

  const handleSave = () => {
    onSaveWinningBid({
      winningBid,
      auctioneerCommission: commissionAmount,
      totalAuctionCost: totalCost,
      auctionDate,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Header com Informações do Banco e Resumo do Imóvel */}
        <div className="p-5 bg-gradient-to-r from-orange-600 via-amber-600 to-slate-900 text-white flex items-start justify-between gap-4 border-b border-orange-700">
          <div className="flex-1 pr-2">
            <PropertyHeaderSummary
              property={property}
              contextTitle="Registrar Lance Vencedor"
              contextBadge="Etapa 10 · Arrematação"
              showKpis={true}
            />
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 bg-slate-50">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-extrabold text-slate-700">
                Valor do Lance Arrematado (R$):
              </label>
              <span className="text-[10px] text-slate-400 font-bold">100% Editável</span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                R$
              </span>
              <input
                type="number"
                value={winningBid}
                onChange={(e) => setWinningBid(Number(e.target.value) || 0)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-extrabold text-slate-700 block mb-1">
                Comissão Leiloeiro (%):
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  value={commissionPct}
                  onChange={(e) => setCommissionPct(Number(e.target.value) || 0)}
                  className="w-full pr-8 pl-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <Percent className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="text-xs font-extrabold text-slate-700 block mb-1">
                Data do Leilão:
              </label>
              <input
                type="date"
                value={auctionDate}
                onChange={(e) => setAuctionDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          {/* Resumo */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Lance Arrematado:</span>
              <span className="font-bold text-white">{formatCurrencyBRL(winningBid)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-300">
              <span>Comissão ({commissionPct}%):</span>
              <span className="font-bold text-orange-400">{formatCurrencyBRL(commissionAmount)}</span>
            </div>
            <div className="border-t border-slate-800 pt-2 flex justify-between text-sm font-black text-white">
              <span>Total no Ato da Arrematação:</span>
              <span className="text-emerald-400">{formatCurrencyBRL(totalCost)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirmar e Concluir Etapa 10</span>
          </button>
        </div>

      </div>
    </div>
  );
};
