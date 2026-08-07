import React from 'react';
import { UserCheck, Search, FileText, Shield, Gavel, Key, Wrench, TrendingUp, CheckCircle2 } from 'lucide-react';
import type { LifecycleStep } from '../types/auction';

interface LifecycleTimelineProps {
  currentStep: LifecycleStep;
  onSelectStep?: (step: LifecycleStep) => void;
}

export const LifecycleTimeline: React.FC<LifecycleTimelineProps> = ({ currentStep, onSelectStep }) => {
  const steps = [
    { number: 1, label: '1. Cadastro', icon: UserCheck, desc: 'Perfil & Capital' },
    { number: 2, label: '2. Escolha', icon: Search, desc: 'Filtros & Oportunidade' },
    { number: 3, label: '3. Edital', icon: FileText, desc: 'Análise de Risco' },
    { number: 4, label: '4. Habilitação', icon: Shield, desc: 'Credenciamento' },
    { number: 5, label: '5. Lance', icon: Gavel, desc: 'Lance Máximo IA' },
    { number: 6, label: '6. Arrematação', icon: Key, desc: 'Auto & Pagamento' },
    { number: 7, label: '7. Posse/Reforma', icon: Wrench, desc: 'Obra & Livro Caixa' },
    { number: 8, label: '8. Venda/Locação', icon: TrendingUp, desc: 'Exit & Lucro Realizado' },
  ];

  return (
    <div className="bg-white border-b border-slate-200 py-3 px-4 shadow-2xs">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between overflow-x-auto scrollbar-none gap-2 py-1">
          {steps.map((s) => {
            const Icon = s.icon;
            const isCurrent = s.number === currentStep;
            const isCompleted = s.number < currentStep;

            return (
              <button
                key={s.number}
                onClick={() => onSelectStep?.(s.number as LifecycleStep)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-xl transition-all flex-shrink-0 text-left cursor-pointer border ${
                  isCurrent
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-500/30'
                    : isCompleted
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                    isCurrent
                      ? 'bg-white/20 text-white'
                      : isCompleted
                      ? 'bg-emerald-200 text-emerald-900'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4 text-emerald-700" /> : <Icon className="w-4 h-4" />}
                </div>
                <div>
                  <span className={`block text-xs font-extrabold leading-tight ${isCurrent ? 'text-white' : 'text-slate-800'}`}>
                    {s.label}
                  </span>
                  <span className={`block text-[10px] font-medium leading-tight ${isCurrent ? 'text-orange-100' : 'text-slate-500'}`}>
                    {s.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
