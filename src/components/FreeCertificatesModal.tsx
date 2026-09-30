import React, { useState } from 'react';
import {
  Scale,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  X,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import { FREE_CERTIFICATES } from '../utils/journeyEngine';

interface FreeCertificatesModalProps {
  propertyTitle: string;
  city: string;
  state: string;
  onClose: () => void;
  onCompleteStep?: () => void;
}

export const FreeCertificatesModal: React.FC<FreeCertificatesModalProps> = ({
  propertyTitle,
  city,
  state,
  onClose,
  onCompleteStep,
}) => {
  const [issuedCertificates, setIssuedCertificates] = useState<Record<string, boolean>>({});

  const toggleIssued = (id: string) => {
    setIssuedCertificates(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const allCount = FREE_CERTIFICATES.length;
  const checkedCount = Object.values(issuedCertificates).filter(Boolean).length;
  const progressPct = Math.round((checkedCount / allCount) * 100);

  const handleMarkAllAndComplete = () => {
    const allDone: Record<string, boolean> = {};
    FREE_CERTIFICATES.forEach(c => (allDone[c.id] = true));
    setIssuedCertificates(allDone);
    if (onCompleteStep) {
      onCompleteStep();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-purple-500/30 text-purple-200 px-2 py-0.5 rounded-full border border-purple-400/30">
                  Etapa 7 · Due Diligence Sem Custos
                </span>
                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  100% Online & Oficial
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-0.5">
                Central de Certidões Negativas Gratuitas
              </h2>
              <p className="text-xs text-slate-300 truncate max-w-md">
                {propertyTitle} ({city}/{state})
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

        {/* Progress Bar & Guia */}
        <div className="p-4 bg-purple-50 border-b border-purple-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
            <p className="text-xs text-purple-950 font-medium leading-tight">
              Emita e consulte as certidões diretamente nos portais oficiais dos tribunais e da Receita Federal sem pagar nada.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <span className="text-xs font-black text-purple-900 whitespace-nowrap">
              {checkedCount}/{allCount} Verificadas
            </span>
            <div className="w-24 bg-purple-200 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-purple-600 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Body - Cards das Certidões */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 bg-slate-50">
          {FREE_CERTIFICATES.map((cert) => {
            const isDone = !!issuedCertificates[cert.id];

            return (
              <div
                key={cert.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isDone
                    ? 'bg-emerald-50/60 border-emerald-300 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-purple-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleIssued(cert.id)}
                      className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center border transition-colors ${
                        isDone
                          ? 'bg-emerald-500 border-emerald-600 text-white'
                          : 'border-slate-300 hover:border-purple-400 bg-white'
                      }`}
                      title={isDone ? 'Marcar como pendente' : 'Marcar como verificada'}
                    >
                      {isDone && <CheckCircle2 className="w-4 h-4" />}
                    </button>

                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="font-black text-slate-900 text-sm">
                          {cert.name}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          {cert.cost}
                        </span>
                        <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {cert.time}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed mb-2">
                        {cert.description}
                      </p>

                      <div className="flex items-center gap-2 text-[11px] text-purple-700 bg-purple-50/80 px-2.5 py-1 rounded-lg border border-purple-100">
                        <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                        <span><strong>Finalidade:</strong> {cert.requiredFor}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <a
                      href={cert.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                    >
                      <span>Emitir Online</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-purple-500 flex-shrink-0" />
            <span>
              Certidões emitidas sem intermediários ou despachantes, com fé pública oficial.
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={handleMarkAllAndComplete}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all shadow-sm flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Concluir Etapa 7 (Due Diligence ✓)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
