import React, { useState, useCallback } from 'react';
import type { Property } from '../types/auction';
import { JourneyTimeline, JOURNEY_STEPS, JOURNEY_PHASES } from './JourneyTimeline';
import type { JourneyStepStatus, JourneyStep } from './JourneyTimeline';
import { JourneyStepPanel } from './JourneyStepPanel';
import { MatrizDespesas } from './MatrizDespesas';
import {
  MapPin, TrendingUp, AlertTriangle, CheckCircle2, ChevronRight,
  BarChart3, Lock, Shield, DollarSign,
} from 'lucide-react';

interface JourneyPageProps {
  property: Property;
  onOpenMaxBid: (p: Property) => void;
}

// Persiste estado da jornada por imóvel em localStorage
const loadJourneyState = (propertyId: string): Record<number, JourneyStepStatus> => {
  try {
    const raw = localStorage.getItem(`journey_${propertyId}`);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

const saveJourneyState = (propertyId: string, state: Record<number, JourneyStepStatus>) => {
  localStorage.setItem(`journey_${propertyId}`, JSON.stringify(state));
};

// Risk assessment from AI opinion (step 5)
const getRiskLevel = (statuses: Record<number, JourneyStepStatus>): 'low' | 'moderate' | 'high' | 'unset' => {
  if ((statuses[5] ?? 'not_started') !== 'completed') return 'unset';
  const score = Math.random(); // Simulado: em prod viria do parecer real
  if (score < 0.33) return 'high';
  if (score < 0.66) return 'moderate';
  return 'low';
};

const RISK_CONFIG = {
  unset: { label: 'Não Analisado', color: 'text-slate-500', bg: 'bg-slate-100', icon: Shield },
  low: { label: 'Baixo ✓ Comprar', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: CheckCircle2 },
  moderate: { label: 'Moderado ⚠ Verificar', color: 'text-amber-700', bg: 'bg-amber-100', icon: AlertTriangle },
  high: { label: 'Alto ✗ Não Comprar', color: 'text-red-700', bg: 'bg-red-100', icon: AlertTriangle },
};

export const JourneyPage: React.FC<JourneyPageProps> = ({ property }) => {
  const [stepStatuses, setStepStatuses] = useState<Record<number, JourneyStepStatus>>(
    () => loadJourneyState(property.id)
  );
  const [selectedStep, setSelectedStep] = useState<JourneyStep | null>(null);
  const [showMatriz, setShowMatriz] = useState(false);

  const riskLevel = getRiskLevel(stepStatuses);
  const riskCfg = RISK_CONFIG[riskLevel];

  const isStepBlocked = useCallback((step: JourneyStep): boolean => {
    if (!step.requires) return false;
    return step.requires.some(r => (stepStatuses[r] ?? 'not_started') !== 'completed');
  }, [stepStatuses]);

  const handleMarkComplete = useCallback((stepNumber: number) => {
    setStepStatuses(prev => {
      const next = { ...prev, [stepNumber]: 'completed' as JourneyStepStatus };
      saveJourneyState(property.id, next);
      return next;
    });
    setSelectedStep(null);
  }, [property.id]);

  const handleMarkPending = useCallback((stepNumber: number) => {
    setStepStatuses(prev => {
      const next = { ...prev, [stepNumber]: 'pending' as JourneyStepStatus };
      saveJourneyState(property.id, next);
      return next;
    });
  }, [property.id]);

  const completedCount = JOURNEY_STEPS.filter(s => (stepStatuses[s.number] ?? 'not_started') === 'completed').length;
  const progressPct = Math.round((completedCount / 21) * 100);

  // Lance bloqueado se risco alto OU etapas 1-9 incompletas
  const step9Status = stepStatuses[9] ?? 'not_started';
  const isLanceBloqueado = riskLevel === 'high' || step9Status !== 'completed';

  return (
    <div className="space-y-4">

      {/* Property Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-orange-100 text-orange-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-orange-200">
                {property.acquisitionType}
              </span>
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {property.occupancyStatus}
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${riskCfg.bg} ${riskCfg.color}`}>
                Risco: {riskCfg.label}
              </span>
            </div>
            <h2 className="font-black text-slate-900 text-lg leading-tight">{property.title}</h2>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" />
              {property.address.street}, {property.address.neighborhood} — {property.address.city}/{property.address.state}
            </p>
          </div>

          {/* KPIs */}
          <div className="hidden sm:flex items-center gap-6 flex-shrink-0">
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Lance mínimo</p>
              <p className="text-lg font-black text-orange-600">
                R$ {(property.secondAuctionPrice).toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Desconto</p>
              <p className="text-lg font-black text-emerald-600">{property.apparentDiscountPercentage}%</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Avaliação</p>
              <p className="text-sm font-bold text-slate-700">
                R$ {(property.appraisalValue).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Progresso da Jornada</span>
            <span className="text-xs font-black text-slate-700">{completedCount}/21 etapas ({progressPct}%)</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full transition-all duration-700 bg-gradient-to-r from-orange-500 to-emerald-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setShowMatriz(true)}
          className="bg-white border border-emerald-200 rounded-2xl p-3 flex items-center gap-2 hover:bg-emerald-50 transition-all text-left"
        >
          <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-600 uppercase">Matriz</p>
            <p className="text-xs font-bold text-emerald-700">de Despesas</p>
          </div>
        </button>

        <div className={`rounded-2xl p-3 flex items-center gap-2 border ${
          isLanceBloqueado ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'
        }`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            isLanceBloqueado ? 'bg-red-100' : 'bg-orange-100'
          }`}>
            {isLanceBloqueado
              ? <Lock className="w-4 h-4 text-red-500" />
              : <ChevronRight className="w-4 h-4 text-orange-600" />
            }
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-600 uppercase">Botão</p>
            <p className={`text-xs font-bold ${isLanceBloqueado ? 'text-red-600' : 'text-orange-700'}`}>
              {isLanceBloqueado ? 'Lance Bloqueado' : 'Dar Lance'}
            </p>
          </div>
        </div>

        <div className={`rounded-2xl p-3 flex items-center gap-2 border ${riskCfg.bg} border-slate-200`}>
          <div className="w-8 h-8 bg-white/60 rounded-xl flex items-center justify-center">
            <riskCfg.icon className={`w-4 h-4 ${riskCfg.color}`} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-600 uppercase">Risco</p>
            <p className={`text-xs font-bold ${riskCfg.color}`}>{riskCfg.label.split(' ')[0]}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-slate-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-600 uppercase">Score</p>
            <p className="text-xs font-bold text-slate-700">{property.opportunityScore}/10</p>
          </div>
        </div>
      </div>

      {/* Phase Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {JOURNEY_PHASES.map(phase => {
          const phaseSteps = phase.steps;
          const completed = phaseSteps.filter(s => (stepStatuses[s.number] ?? 'not_started') === 'completed').length;
          const isFullyDone = completed === phaseSteps.length;
          return (
            <div
              key={phase.number}
              className={`rounded-2xl p-3 border text-center ${
                isFullyDone ? 'bg-emerald-50 border-emerald-200' : `${phase.bgColor} ${phase.borderColor}`
              }`}
            >
              <div className={`text-[9px] font-black uppercase tracking-wider ${isFullyDone ? 'text-emerald-600' : phase.color} mb-1`}>
                Fase {phase.number}
              </div>
              <div className="font-black text-slate-800 text-sm">{completed}/{phaseSteps.length}</div>
              <div className={`text-[9px] ${isFullyDone ? 'text-emerald-600' : 'text-slate-500'} leading-tight mt-0.5`}>
                {isFullyDone ? '✓ Completa' : phase.label.split(' ')[0]}
              </div>
            </div>
          );
        })}
      </div>

      {/* Timeline (from JourneyTimeline component) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-black text-slate-900 text-sm">Linha do Tempo — 21 Etapas</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Clique em uma fase para expandir suas etapas</p>
          </div>
          <TrendingUp className="w-5 h-5 text-orange-500" />
        </div>
        <div className="p-1">
          <JourneyTimeline
            stepStatuses={stepStatuses}
            onSelectStep={setSelectedStep}
          />
        </div>
      </div>

      {/* Step Panel Modal */}
      {selectedStep && (
        <JourneyStepPanel
          step={selectedStep}
          status={stepStatuses[selectedStep.number] ?? 'not_started'}
          isBlocked={isStepBlocked(selectedStep)}
          blockedBySteps={selectedStep.requires?.filter(r => (stepStatuses[r] ?? 'not_started') !== 'completed')}
          onClose={() => setSelectedStep(null)}
          onMarkComplete={handleMarkComplete}
          onMarkPending={handleMarkPending}
        />
      )}

      {/* Matriz de Despesas Modal */}
      {showMatriz && (
        <MatrizDespesas
          property={property}
          onClose={() => setShowMatriz(false)}
        />
      )}
    </div>
  );
};
