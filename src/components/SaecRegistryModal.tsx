import React, { useState } from 'react';
import {
  Globe,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  X,
} from 'lucide-react';
import { estimateRegistryFees } from '../utils/journeyEngine';

interface SaecRegistryModalProps {
  property: any;
  winningBidAmount?: number;
  onClose: () => void;
  onSaveRegistry: (data: {
    estimatedFee: number;
    prenotationNumber: string;
    protocolDate: string;
  }) => void;
}

export const SaecRegistryModal: React.FC<SaecRegistryModalProps> = ({
  property,
  winningBidAmount,
  onClose,
  onSaveRegistry,
}) => {
  const city = property.address?.city || property.city || 'São Paulo';
  const state = property.address?.state || property.state || 'SP';
  const baseValue = winningBidAmount || Number(property.secondAuctionPrice || property.sale_value || 300000);

  const initialEstimate = estimateRegistryFees(baseValue, state);

  const [registryFee, setRegistryFee] = useState<number>(initialEstimate.estimatedCost);
  const [prenotationNumber, setPrenotationNumber] = useState<string>('');
  const [protocolDate, setProtocolDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const handleSave = () => {
    onSaveRegistry({
      estimatedFee: registryFee,
      prenotationNumber,
      protocolDate,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-blue-900 via-sky-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-300">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-sky-500/30 text-sky-200 px-2 py-0.5 rounded-full border border-sky-400/30">
                  Etapa 14 · Registro Imobiliário
                </span>
                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  100% Online via SAEC / ONR
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-0.5">
                Protocolo Eletrônico de Registro (RGI)
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

        {/* Guia SAEC */}
        <div className="p-4 bg-sky-50 border-b border-sky-100 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black text-sky-900">
              Registro 100% Eletrônico sem Comparecer ao Cartório:
            </p>
            <p className="text-xs text-sky-800 leading-relaxed mt-0.5">
              Pelo <strong>SAEC (Serviço de Atendimento Eletrônico Compartilhado)</strong> gerido pelo Operador Nacional do Registro de Imóveis (ONR), você protocola a Carta de Arrematação ou o Contrato de Compra e Venda assinado eletronicamente pelo portal nacional.
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50">
          
          {/* Link para o SAEC */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div>
              <p className="text-xs font-black text-slate-900">
                Acessar Portal Nacional dos Registradores (ONR):
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Envie o arquivo PDF com certificado ICP-Brasil para protocolo direto.
              </p>
            </div>

            <a
              href="https://registradores.onr.org.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 flex-shrink-0 shadow-sm"
            >
              <span>Abrir registradores.onr.org.br</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Emolumentos Estimados (TJ Estadual) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-xs font-black text-slate-900">
                Estimativa de Emolumentos Cartorários ({state})
              </h4>
              <span className="text-[10px] font-bold text-slate-500">
                Tabela de Custas do TJ{state}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-extrabold text-slate-700">
                    Custo de Registro Cartorário (R$):
                  </label>
                  <span className="text-[10px] text-slate-400 font-bold">100% Editável</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                    R$
                  </span>
                  <input
                    type="number"
                    value={registryFee}
                    onChange={(e) => setRegistryFee(Number(e.target.value) || 0)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Aproximadamente {((registryFee / baseValue) * 100).toFixed(2)}% sobre o valor arrematado.
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed">
                {initialEstimate.description} O cartório emite o boleto oficial após a qualificação do título.
              </div>
            </div>
          </div>

          {/* Prenotação e Protocolo */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-sm">
            <h4 className="text-xs font-black text-slate-900 border-b border-slate-100 pb-2">
              Acompanhamento de Prenotação
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">
                  Número de Prenotação / Protocolo:
                </label>
                <input
                  type="text"
                  value={prenotationNumber}
                  onChange={(e) => setPrenotationNumber(e.target.value)}
                  placeholder="Ex: 452.890"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">
                  Data do Protocolo:
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={protocolDate}
                    onChange={(e) => setProtocolDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 mt-1">
              ⚠️ <strong>Atenção ao Prazo da Prenotação:</strong> O cartório tem 30 dias para registrar ou suscitar nota de exigência.
            </p>
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
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Salvar Protocolo e Concluir Etapa 14</span>
          </button>
        </div>

      </div>
    </div>
  );
};
