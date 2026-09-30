import React, { useState, useCallback, useEffect } from 'react';
import type { Property } from '../types/auction';
import { JourneyTimeline, JOURNEY_STEPS, JOURNEY_PHASES } from './JourneyTimeline';
import type { JourneyStepStatus, JourneyStep } from './JourneyTimeline';
import { JourneyStepPanel } from './JourneyStepPanel';
import { MatrizDespesas } from './MatrizDespesas';
import { MaxBidCalculator } from './MaxBidCalculator';
import { FinanciamentoCaixaModal } from './FinanciamentoCaixaModal';
import { EditalAnalysisModal } from './EditalAnalysisModal';
import { FreeCertificatesModal } from './FreeCertificatesModal';
import { DebtAdvisorModal } from './DebtAdvisorModal';
import { ItbiCalculatorModal } from './ItbiCalculatorModal';
import { SaecRegistryModal } from './SaecRegistryModal';
import { WinningBidModal } from './WinningBidModal';
import { PropertyReportModal } from './PropertyReportModal';
import { RenovationManager } from './RenovationManager';
import { WhatsAppSimulator } from './WhatsAppSimulator';
import { PartnerNetwork } from './PartnerNetwork';
import { mockParceiros } from '../data/mockParceiros';

import {
  MapPin, TrendingUp, CheckCircle2,
  Shield, DollarSign, Sparkles, Building2,
  Scale, Receipt, Printer, RefreshCw,
} from 'lucide-react';
import { formatCurrencyBRL } from '../utils/financial';
import { analyzePropertyWithG2AI } from '../utils/aiEditalEngine';
import {
  runJourneyAutoDiagnostic,
} from '../utils/journeyEngine';

interface JourneyPageProps {
  property: Property;
  availableProperties?: Property[];
  onSelectProperty?: (p: Property) => void;
  onOpenMaxBid?: (p: Property) => void;
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

// Avaliação de risco real via G2 AI Engine
const getRealRiskLevel = (property: Property, statuses: Record<number, JourneyStepStatus>): 'low' | 'moderate' | 'high' | 'unset' => {
  if ((statuses[5] ?? 'not_started') !== 'completed' && (statuses[3] ?? 'not_started') !== 'completed') {
    return 'unset';
  }
  const aiRes = analyzePropertyWithG2AI(property, '');
  if (aiRes.hasUnregisteredBuilding || aiRes.isCashOnly) return 'moderate';
  if ((property.acquisitionType as string) === 'JUDICIAL') return 'moderate';
  return 'low';
};

const RISK_CONFIG = {
  unset: { label: 'Não Analisado', color: 'text-slate-500', bg: 'bg-slate-100', icon: Shield },
  low: { label: 'Baixo ✓ Comprar', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: CheckCircle2 },
  moderate: { label: 'Moderado ⚠ Verificar', color: 'text-amber-700', bg: 'bg-amber-100', icon: Shield },
  high: { label: 'Alto ✗ Não Comprar', color: 'text-red-700', bg: 'bg-red-100', icon: Shield },
};

export const JourneyPage: React.FC<JourneyPageProps> = ({
  property,
  availableProperties = [],
  onSelectProperty,
  onOpenMaxBid: _onOpenMaxBid,
}) => {
  const [stepStatuses, setStepStatuses] = useState<Record<number, JourneyStepStatus>>(
    () => loadJourneyState(property.id)
  );
  const [selectedStep, setSelectedStep] = useState<JourneyStep | null>(null);

  // Modais de Ação Direta
  const [showMatriz, setShowMatriz] = useState(false);
  const [showMaxBid, setShowMaxBid] = useState(false);
  const [showFinancing, setShowFinancing] = useState(false);
  const [showEditalAnalysis, setShowEditalAnalysis] = useState(false);
  const [showFreeCertificates, setShowFreeCertificates] = useState(false);
  const [showDebtAdvisor, setShowDebtAdvisor] = useState(false);
  const [showItbiCalculator, setShowItbiCalculator] = useState(false);
  const [showSaecRegistry, setShowSaecRegistry] = useState(false);
  const [showWinningBid, setShowWinningBid] = useState(false);
  const [showRenovation, setShowRenovation] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showPartnerNetwork, setShowPartnerNetwork] = useState(false);

  // Estado dos débitos e lance da jornada
  const [journeyDebts, setJourneyDebts] = useState<{
    iptuAmount: number;
    condoAmount: number;
    responsibleParty: 'banco' | 'arrematante';
  }>(() => {
    try {
      const raw = localStorage.getItem(`journey_debts_${property.id}`);
      return raw ? JSON.parse(raw) : { iptuAmount: 0, condoAmount: 0, responsibleParty: 'banco' };
    } catch {
      return { iptuAmount: 0, condoAmount: 0, responsibleParty: 'banco' };
    }
  });

  const [winningBidData, setWinningBidData] = useState<{
    winningBid: number;
    auctioneerCommission: number;
    totalAuctionCost: number;
    auctionDate: string;
  } | null>(() => {
    try {
      const raw = localStorage.getItem(`journey_bid_${property.id}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // Atualiza estados ao trocar de imóvel
  useEffect(() => {
    const loaded = loadJourneyState(property.id);
    // Executa auto-diagnóstico inicial de forma não-intrusiva
    const autoUpdated = runJourneyAutoDiagnostic(property, loaded);
    setStepStatuses(autoUpdated as Record<number, JourneyStepStatus>);
    saveJourneyState(property.id, autoUpdated as Record<number, JourneyStepStatus>);

    try {
      const rawDebts = localStorage.getItem(`journey_debts_${property.id}`);
      if (rawDebts) setJourneyDebts(JSON.parse(rawDebts));
      const rawBid = localStorage.getItem(`journey_bid_${property.id}`);
      if (rawBid) setWinningBidData(JSON.parse(rawBid));
    } catch {}
  }, [property.id]);

  const riskLevel = getRealRiskLevel(property, stepStatuses);
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

  // Executa auto-diagnóstico manual completo
  const handleRunFullAutoDiagnostic = () => {
    const diagnosed = runJourneyAutoDiagnostic(property, stepStatuses);
    setStepStatuses(diagnosed as Record<number, JourneyStepStatus>);
    saveJourneyState(property.id, diagnosed as Record<number, JourneyStepStatus>);
  };

  const completedCount = JOURNEY_STEPS.filter(s => (stepStatuses[s.number] ?? 'not_started') === 'completed').length;
  const progressPct = Math.round((completedCount / 21) * 100);

  return (
    <div className="space-y-4">

      {/* Property Header & Selector Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
        
        {/* Top Switcher & Badges */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="bg-orange-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Minha Jornada Ativa
            </span>
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

          {/* Troca de Imóvel */}
          {availableProperties.length > 1 && onSelectProperty && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Trocar Imóvel:</span>
              <select
                value={property.id}
                onChange={(e) => {
                  const found = availableProperties.find(p => p.id === e.target.value);
                  if (found) onSelectProperty(found);
                }}
                className="w-full sm:w-64 bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer truncate"
              >
                {availableProperties.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.address.city}/{p.address.state})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Informações Centrais do Imóvel */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="font-black text-slate-900 text-lg leading-tight">{property.title}</h2>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
              <span>{property.address.street}, {property.address.neighborhood} — {property.address.city}/{property.address.state}</span>
            </p>
          </div>

          {/* KPIs Principais */}
          <div className="hidden sm:flex items-center gap-6 flex-shrink-0">
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Lance Mínimo</p>
              <p className="text-lg font-black text-orange-600">
                {formatCurrencyBRL(property.secondAuctionPrice || (property as any).sale_value)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Desconto</p>
              <p className="text-lg font-black text-emerald-600">
                {property.apparentDiscountPercentage ?? (property as any).discount_percentage}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Avaliação</p>
              <p className="text-sm font-bold text-slate-700">
                {formatCurrencyBRL(property.appraisalValue ?? (property as any).appraisal_value)}
              </p>
            </div>
          </div>
        </div>

        {/* Banner de Auto-Diagnóstico Inteligente */}
        <div className="p-3.5 bg-gradient-to-r from-orange-50 via-amber-50 to-emerald-50 rounded-2xl border border-orange-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-900">
                ⚡ Auto-Diagnóstico de Etapas G2
              </p>
              <p className="text-[11px] text-slate-600 leading-tight">
                O sistema lê os dados cadastrados do lote para validar etapas e orientar sua próxima ação.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleRunFullAutoDiagnostic}
              className="px-3.5 py-1.5 bg-white hover:bg-orange-50 text-orange-700 border border-orange-300 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3 text-orange-500" />
              <span>Verificar Auto-Completar</span>
            </button>

            <button
              onClick={() => setShowDebtAdvisor(true)}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Diagnóstico de IPTU & Condomínio</span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Progresso da Jornada
            </span>
            <span className="text-xs font-black text-slate-700">
              {completedCount}/21 etapas ({progressPct}%)
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full transition-all duration-700 bg-gradient-to-r from-orange-500 to-emerald-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

      </div>

      {/* Quick Actions Grid (Centro de Comando) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
        <button
          onClick={() => setShowEditalAnalysis(true)}
          className="bg-white border border-orange-200 rounded-2xl p-3 flex items-center gap-2 hover:bg-orange-50 transition-all text-left shadow-sm"
        >
          <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-orange-600" />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] font-black text-slate-600 uppercase">Análise IA</p>
            <p className="text-xs font-bold text-orange-700 truncate">Edital & Riscos</p>
          </div>
        </button>

        <button
          onClick={() => setShowMaxBid(true)}
          className="bg-white border border-amber-200 rounded-2xl p-3 flex items-center gap-2 hover:bg-amber-50 transition-all text-left shadow-sm"
        >
          <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] font-black text-slate-600 uppercase">Preço-Teto</p>
            <p className="text-xs font-bold text-amber-700 truncate">Lance Máximo</p>
          </div>
        </button>

        <button
          onClick={() => setShowFreeCertificates(true)}
          className="bg-white border border-purple-200 rounded-2xl p-3 flex items-center gap-2 hover:bg-purple-50 transition-all text-left shadow-sm"
        >
          <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Scale className="w-4 h-4 text-purple-600" />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] font-black text-slate-600 uppercase">Due Diligence</p>
            <p className="text-xs font-bold text-purple-700 truncate">Certidões Grátis</p>
          </div>
        </button>

        <button
          onClick={() => setShowItbiCalculator(true)}
          className="bg-white border border-blue-200 rounded-2xl p-3 flex items-center gap-2 hover:bg-blue-50 transition-all text-left shadow-sm"
        >
          <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Receipt className="w-4 h-4 text-blue-600" />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] font-black text-slate-600 uppercase">Tributos</p>
            <p className="text-xs font-bold text-blue-700 truncate">ITBI Municipal</p>
          </div>
        </button>

        <button
          onClick={() => setShowMatriz(true)}
          className="bg-white border border-emerald-200 rounded-2xl p-3 flex items-center gap-2 hover:bg-emerald-50 transition-all text-left shadow-sm"
        >
          <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Receipt className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] font-black text-slate-600 uppercase">Custos</p>
            <p className="text-xs font-bold text-emerald-700 truncate">Matriz Despesas</p>
          </div>
        </button>

        <button
          onClick={() => setShowReport(true)}
          className="bg-white border border-slate-300 rounded-2xl p-3 flex items-center gap-2 hover:bg-slate-50 transition-all text-left shadow-sm"
        >
          <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Printer className="w-4 h-4 text-slate-600" />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] font-black text-slate-600 uppercase">Dossiê</p>
            <p className="text-xs font-bold text-slate-700 truncate">Imprimir PDF</p>
          </div>
        </button>
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
              className={`rounded-2xl p-3 border text-center transition-all ${
                isFullyDone ? 'bg-emerald-50 border-emerald-200 shadow-sm' : `${phase.bgColor} ${phase.borderColor}`
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
            <h3 className="font-black text-slate-900 text-sm">Linha do Tempo Operacional — 21 Etapas</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Clique em uma etapa para abrir o checklist e executar a ação correspondente</p>
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

      {/* Step Panel Modal (Com botões de ação e dados do imóvel) */}
      {selectedStep && (
        <JourneyStepPanel
          step={selectedStep}
          status={stepStatuses[selectedStep.number] ?? 'not_started'}
          isBlocked={isStepBlocked(selectedStep)}
          blockedBySteps={selectedStep.requires?.filter(r => (stepStatuses[r] ?? 'not_started') !== 'completed')}
          property={property}
          onClose={() => setSelectedStep(null)}
          onMarkComplete={handleMarkComplete}
          onMarkPending={handleMarkPending}

          // Ações Nativas Conectadas
          onOpenEditalAnalysis={() => setShowEditalAnalysis(true)}
          onOpenMaxBid={() => setShowMaxBid(true)}
          onOpenFinancing={() => setShowFinancing(true)}
          onOpenMatrizDespesas={() => setShowMatriz(true)}
          onOpenDebtAdvisor={() => setShowDebtAdvisor(true)}
          onOpenFreeCertificates={() => setShowFreeCertificates(true)}
          onOpenWinningBid={() => setShowWinningBid(true)}
          onOpenItbiCalculator={() => setShowItbiCalculator(true)}
          onOpenSaecRegistry={() => setShowSaecRegistry(true)}
          onOpenRenovationManager={() => setShowRenovation(true)}
          onOpenReportModal={() => setShowReport(true)}
          onOpenWhatsAppSimulator={() => setShowWhatsApp(true)}
          onOpenPartnerNetwork={() => setShowPartnerNetwork(true)}
        />
      )}

      {/* MODAL 1: Análise de Edital via G2 AI Engine */}
      {showEditalAnalysis && (
        <EditalAnalysisModal
          property={property}
          onClose={() => setShowEditalAnalysis(false)}
        />
      )}

      {/* MODAL 2: Calculadora de Lance Máximo (Preço-Teto) */}
      {showMaxBid && (
        <MaxBidCalculator
          property={property}
          onClose={() => setShowMaxBid(false)}
        />
      )}

      {/* MODAL 3: Simulador de Financiamento */}
      {showFinancing && (
        <FinanciamentoCaixaModal
          property={property}
          onClose={() => setShowFinancing(false)}
        />
      )}

      {/* MODAL 4: Matriz de Despesas Detalhada */}
      {showMatriz && (
        <MatrizDespesas
          property={property}
          onClose={() => setShowMatriz(false)}
        />
      )}

      {/* MODAL 5: Central de Certidões Negativas 100% Gratuitas */}
      {showFreeCertificates && (
        <FreeCertificatesModal
          propertyTitle={property.title}
          city={property.address.city}
          state={property.address.state}
          onClose={() => setShowFreeCertificates(false)}
          onCompleteStep={() => handleMarkComplete(7)}
        />
      )}

      {/* MODAL 6: Diagnóstico de Débitos (IPTU e Condomínio com % Teto & IA) */}
      {showDebtAdvisor && (
        <DebtAdvisorModal
          property={property}
          currentIptuDebt={journeyDebts.iptuAmount}
          currentCondoDebt={journeyDebts.condoAmount}
          onClose={() => setShowDebtAdvisor(false)}
          onSaveDebts={(data) => {
            setJourneyDebts({
              iptuAmount: data.iptuAmount,
              condoAmount: data.condoAmount,
              responsibleParty: data.responsibleParty,
            });
            localStorage.setItem(`journey_debts_${property.id}`, JSON.stringify(data));
            // Marca etapa de análise e viabilidade como verificadas
            handleMarkComplete(3);
          }}
        />
      )}

      {/* MODAL 7: Calculadora de ITBI Municipal (STJ 1113) */}
      {showItbiCalculator && (
        <ItbiCalculatorModal
          property={property}
          winningBidAmount={winningBidData?.winningBid}
          onClose={() => setShowItbiCalculator(false)}
          onSaveItbi={(data) => {
            localStorage.setItem(`journey_itbi_${property.id}`, JSON.stringify(data));
            handleMarkComplete(13);
          }}
        />
      )}

      {/* MODAL 8: Registro SAEC / ONR Online */}
      {showSaecRegistry && (
        <SaecRegistryModal
          property={property}
          winningBidAmount={winningBidData?.winningBid}
          onClose={() => setShowSaecRegistry(false)}
          onSaveRegistry={(data) => {
            localStorage.setItem(`journey_registry_${property.id}`, JSON.stringify(data));
            handleMarkComplete(14);
          }}
        />
      )}

      {/* MODAL 9: Registro do Lance Vencedor */}
      {showWinningBid && (
        <WinningBidModal
          property={property}
          currentBid={property.secondAuctionPrice || (property as any).sale_value}
          onClose={() => setShowWinningBid(false)}
          onSaveWinningBid={(data) => {
            setWinningBidData(data);
            localStorage.setItem(`journey_bid_${property.id}`, JSON.stringify(data));
            handleMarkComplete(10);
          }}
        />
      )}

      {/* MODAL 10: Gestor de Reformas & Obras */}
      {showRenovation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6 p-6">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-lg">Gestão de Obra e Reforma Express</h3>
              <button onClick={() => setShowRenovation(false)} className="text-slate-400 hover:text-slate-600 p-2">
                ✕
              </button>
            </div>
            <RenovationManager property={property} />
          </div>
        </div>
      )}

      {/* MODAL 11: Dossiê e Relatório Completo */}
      {showReport && (
        <PropertyReportModal
          property={property}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* MODAL 12: Simulador WhatsApp */}
      {showWhatsApp && (
        <WhatsAppSimulator
          isOpen={showWhatsApp}
          onClose={() => setShowWhatsApp(false)}
          properties={[property]}
          onSelectProperty={() => {}}
        />
      )}

      {/* MODAL 13: Rede de Parceiros */}
      {showPartnerNetwork && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6 p-6">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-lg">Rede de Parceiros Especialistas</h3>
              <button onClick={() => setShowPartnerNetwork(false)} className="text-slate-400 hover:text-slate-600 p-2">
                ✕
              </button>
            </div>
            <PartnerNetwork partners={mockParceiros} />
          </div>
        </div>
      )}

    </div>
  );
};
