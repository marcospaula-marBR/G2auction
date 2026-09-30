import React, { useState } from 'react';
import {
  X,
  CheckSquare,
  Square,
  Upload,
  Play,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  Calculator,
  Building2,
  Scale,
  MapPin,
  CreditCard,
  Receipt,
  Globe,
  Wrench,
  Printer,
  MessageSquare,
  Users,
  Gavel,
  TrendingUp,
} from 'lucide-react';
import type { JourneyStep, JourneyStepStatus } from './JourneyTimeline';
import { getIptuPortalLink } from '../utils/journeyEngine';

interface JourneyStepPanelProps {
  step: JourneyStep;
  status: JourneyStepStatus;
  isBlocked: boolean;
  blockedBySteps?: number[];
  property: any;
  onClose: () => void;
  onMarkComplete: (stepNumber: number) => void;
  onMarkPending: (stepNumber: number) => void;

  // Ações Diretas Nativas
  onOpenEditalAnalysis?: () => void;
  onOpenMaxBid?: () => void;
  onOpenFinancing?: () => void;
  onOpenMatrizDespesas?: () => void;
  onOpenDebtAdvisor?: () => void;
  onOpenFreeCertificates?: () => void;
  onOpenWinningBid?: () => void;
  onOpenItbiCalculator?: () => void;
  onOpenSaecRegistry?: () => void;
  onOpenRenovationManager?: () => void;
  onOpenReportModal?: () => void;
  onOpenWhatsAppSimulator?: () => void;
  onOpenPartnerNetwork?: () => void;
}

const STATUS_CONFIG = {
  completed: { label: 'Concluída', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  pending: { label: 'Pendente / Em Análise', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-400' },
  not_started: { label: 'Não Iniciada', color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', dot: 'bg-slate-300' },
  blocked: { label: 'Bloqueada', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-400' },
};

export const JourneyStepPanel: React.FC<JourneyStepPanelProps> = ({
  step,
  status,
  isBlocked,
  blockedBySteps = [],
  property,
  onClose,
  onMarkComplete,
  onMarkPending,
  onOpenEditalAnalysis,
  onOpenMaxBid,
  onOpenFinancing,
  onOpenMatrizDespesas,
  onOpenDebtAdvisor,
  onOpenFreeCertificates,
  onOpenWinningBid,
  onOpenItbiCalculator,
  onOpenSaecRegistry,
  onOpenRenovationManager,
  onOpenReportModal,
  onOpenWhatsAppSimulator,
  onOpenPartnerNetwork,
}) => {
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const cfg = STATUS_CONFIG[status];
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalItems = step.checklist.length;
  const progressPct = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

  const toggleItem = (idx: number) => {
    setCheckedItems(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleFakeUpload = () => {
    const fakeFiles = ['edital_completo.pdf', 'matricula_atualizada.pdf', 'certidao_negativa.pdf', 'comprovante.pdf', 'laudo.pdf'];
    const randomFile = fakeFiles[Math.floor(Math.random() * fakeFiles.length)];
    setUploadedFiles(prev => [...prev, randomFile]);
  };

  const city = property.address?.city || property.city || 'São Paulo';
  const state = property.address?.state || property.state || 'SP';
  const street = property.address?.street || property.address || '';
  const neighborhood = property.address?.neighborhood || '';
  const fullAddress = `${street}, ${neighborhood}, ${city} - ${state}`;
  const streetViewUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
  const officialPageUrl = property.original_url || property.source_url || property.auctioneerSite || property.url || `https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnImovel=${property.source_property_id || property.id}`;
  const iptuPortal = getIptuPortalLink(city, state);

  // Renderiza a Seção de Execução Direta por Etapa
  const renderActionButtons = () => {
    switch (step.number) {
      case 1: // Pesquisa do Imóvel
        return (
          <div className="flex flex-wrap gap-2">
            <a
              href={streetViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs rounded-xl shadow-md hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-1.5"
            >
              <MapPin className="w-4 h-4" />
              <span>[ 🗺️ Vistoria Virtual 360° (Google Maps) ]</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        );

      case 2: // Coleta do Edital
        return (
          <div className="flex flex-wrap gap-2">
            <a
              href={officialPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
            >
              <Globe className="w-4 h-4" />
              <span>[ 🌐 Abrir Página Oficial no Banco / Leiloeiro ]</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            {onOpenEditalAnalysis && (
              <button
                onClick={onOpenEditalAnalysis}
                className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>[ 🤖 Analisar Edital com G2 AI ]</span>
              </button>
            )}
          </div>
        );

      case 3: // Análise do Edital
        return (
          <div className="flex flex-wrap gap-2">
            {onOpenEditalAnalysis && (
              <button
                onClick={onOpenEditalAnalysis}
                className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>[ 🤖 Analisar Cláusulas & Riscos (G2 AI) ]</span>
              </button>
            )}
            {onOpenDebtAdvisor && (
              <button
                onClick={onOpenDebtAdvisor}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-amber-300 font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <Building2 className="w-4 h-4 text-amber-400" />
                <span>[ ⚖️ Diagnóstico de IPTU & Condomínio ]</span>
              </button>
            )}
          </div>
        );

      case 4: // Viabilidade Financeira (Lance Máximo, Financiamento, Matriz)
        return (
          <div className="flex flex-wrap gap-2">
            {onOpenMaxBid && (
              <button
                onClick={onOpenMaxBid}
                className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <Calculator className="w-4 h-4" />
                <span>[ 💰 Calculadora Lance Máximo (Preço-Teto) ]</span>
              </button>
            )}
            {onOpenFinancing && (
              <button
                onClick={onOpenFinancing}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <CreditCard className="w-4 h-4" />
                <span>[ 🏦 Simular Financiamento ]</span>
              </button>
            )}
            {onOpenMatrizDespesas && (
              <button
                onClick={onOpenMatrizDespesas}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <Receipt className="w-4 h-4" />
                <span>[ 📊 Matriz de Despesas ]</span>
              </button>
            )}
            {onOpenDebtAdvisor && (
              <button
                onClick={onOpenDebtAdvisor}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-amber-300 font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <Building2 className="w-4 h-4 text-amber-400" />
                <span>[ ⚖️ Estipular Débitos / % Teto ]</span>
              </button>
            )}
          </div>
        );

      case 5: // Parecer por IA
        return (
          <div className="flex flex-wrap gap-2">
            {onOpenEditalAnalysis && (
              <button
                onClick={onOpenEditalAnalysis}
                className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>[ 🤖 Gerar Parecer de Risco por IA ]</span>
              </button>
            )}
          </div>
        );

      case 6: // Matrícula Atualizada
        return (
          <div className="flex flex-wrap gap-2">
            <a
              href="https://registradores.onr.org.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
            >
              <Globe className="w-4 h-4" />
              <span>[ 🏛️ Visualização de Matrícula no ONR / SAEC ]</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href={officialPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
            >
              <Building2 className="w-4 h-4 text-orange-400" />
              <span>[ 📄 Buscar Matrícula no Lote Oficial ]</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        );

      case 7: // Pesquisa Jurídica (Due Diligence sem Custos)
        return (
          <div className="flex flex-wrap gap-2">
            {onOpenFreeCertificates && (
              <button
                onClick={onOpenFreeCertificates}
                className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <Scale className="w-4 h-4" />
                <span>[ ⚖️ Central de Certidões 100% Gratuitas (CNDT / TRF / TJ) ]</span>
              </button>
            )}
            {onOpenPartnerNetwork && (
              <button
                onClick={onOpenPartnerNetwork}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <Users className="w-4 h-4 text-purple-400" />
                <span>[ 👥 Conectar com Advogado Especialista ]</span>
              </button>
            )}
          </div>
        );

      case 8: // Posse e Ocupação
        return (
          <div className="flex flex-wrap gap-2">
            <a
              href={streetViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
            >
              <MapPin className="w-4 h-4" />
              <span>[ 🗺️ Vistoria Virtual 360° da Fachada & Rua ]</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            {onOpenWhatsAppSimulator && (
              <button
                onClick={onOpenWhatsAppSimulator}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                <span>[ 💬 Modelo de Notificação Amigável ao Ocupante ]</span>
              </button>
            )}
          </div>
        );

      case 9: // Cadastro e Habilitação
        return (
          <div className="flex flex-wrap gap-2">
            <a
              href={officialPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
            >
              <Globe className="w-4 h-4" />
              <span>[ 🌐 Ir para Cadastro no Leiloeiro Oficial ]</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        );

      case 10: // Arrematação (Lance Vencedor)
        return (
          <div className="flex flex-wrap gap-2">
            {onOpenWinningBid && (
              <button
                onClick={onOpenWinningBid}
                className="px-4 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <Gavel className="w-4 h-4" />
                <span>[ 🔨 Registrar Lance Vencedor ]</span>
              </button>
            )}
            {onOpenMaxBid && (
              <button
                onClick={onOpenMaxBid}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <Calculator className="w-4 h-4 text-orange-400" />
                <span>[ 💰 Consultar Preço-Teto ]</span>
              </button>
            )}
          </div>
        );

      case 11: // Pagamento
        return (
          <div className="flex flex-wrap gap-2">
            {onOpenMatrizDespesas && (
              <button
                onClick={onOpenMatrizDespesas}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <CreditCard className="w-4 h-4" />
                <span>[ 💳 Matriz de Custos de Pagamento ]</span>
              </button>
            )}
          </div>
        );

      case 13: // ITBI
        return (
          <div className="flex flex-wrap gap-2">
            {onOpenItbiCalculator && (
              <button
                onClick={onOpenItbiCalculator}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <Receipt className="w-4 h-4" />
                <span>[ 🏷️ Calculadora de ITBI Municipal (STJ 1113) ]</span>
              </button>
            )}
            <a
              href={iptuPortal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
            >
              <ExternalLink className="w-4 h-4 text-blue-400" />
              <span>[ 🏙️ Emissão na Prefeitura de {city} ]</span>
            </a>
          </div>
        );

      case 14: // Registro Online (SAEC / ONR)
        return (
          <div className="flex flex-wrap gap-2">
            {onOpenSaecRegistry && (
              <button
                onClick={onOpenSaecRegistry}
                className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <Globe className="w-4 h-4" />
                <span>[ 🌐 Protocolar no SAEC / Estimativa Cartório ]</span>
              </button>
            )}
            <a
              href="https://registradores.onr.org.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              <span>[ Abrir registradores.onr.org.br ]</span>
            </a>
          </div>
        );

      case 16: // IPTU e Contribuinte
        return (
          <div className="flex flex-wrap gap-2">
            <a
              href={iptuPortal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
            >
              <Building2 className="w-4 h-4" />
              <span>[ 🏙️ Consultar Débitos no Portal de {city} ]</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            {onOpenDebtAdvisor && (
              <button
                onClick={onOpenDebtAdvisor}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-amber-300 font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <Receipt className="w-4 h-4 text-amber-400" />
                <span>[ ⚖️ Diagnóstico & Quitação de IPTU ]</span>
              </button>
            )}
          </div>
        );

      case 17: // Condomínio
        return (
          <div className="flex flex-wrap gap-2">
            {onOpenDebtAdvisor && (
              <button
                onClick={onOpenDebtAdvisor}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>[ 🤖 Provisão de Condomínio por IA (% Teto) ]</span>
              </button>
            )}
            {onOpenWhatsAppSimulator && (
              <button
                onClick={onOpenWhatsAppSimulator}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                <span>[ 📱 Notificar Síndico / Administradora ]</span>
              </button>
            )}
          </div>
        );

      case 18: // Posse, Vistoria e Reforma
        return (
          <div className="flex flex-wrap gap-2">
            {onOpenRenovationManager && (
              <button
                onClick={onOpenRenovationManager}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <Wrench className="w-4 h-4" />
                <span>[ 🛠️ Abrir Gestor de Obras e Reforma Express ]</span>
              </button>
            )}
          </div>
        );

      case 19: // Revenda com Corretores
        return (
          <div className="flex flex-wrap gap-2">
            {onOpenPartnerNetwork && (
              <button
                onClick={onOpenPartnerNetwork}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <Users className="w-4 h-4" />
                <span>[ 👥 Conectar Rede de Corretores Parceiros ]</span>
              </button>
            )}
          </div>
        );

      case 20: // Ganho de Capital (GCAP)
        return (
          <div className="flex flex-wrap gap-2">
            {onOpenMatrizDespesas && (
              <button
                onClick={onOpenMatrizDespesas}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <TrendingUp className="w-4 h-4" />
                <span>[ 🧮 Apuração de Custo Total & Lucro Líquido ]</span>
              </button>
            )}
          </div>
        );

      case 21: // Fechamento Final
        return (
          <div className="flex flex-wrap gap-2">
            {onOpenReportModal && (
              <button
                onClick={onOpenReportModal}
                className="px-4 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>[ 📑 Emitir Dossiê Completo de Arrematação (PDF) ]</span>
              </button>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/65 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
      <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${cfg.bg} ${cfg.border} border`}>
              {step.emoji}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                <span className="text-[10px] text-slate-400">· Etapa {step.number} de 21</span>
              </div>
              <h2 className="font-black text-slate-900 text-base leading-tight">{step.label}</h2>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors ml-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body - scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Bloqueio */}
          {isBlocked && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <Lock className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-700">Etapa Bloqueada</p>
                <p className="text-xs text-red-600 mt-0.5">
                  Complete primeiro as etapas {blockedBySteps.join(', ')} para desbloquear esta etapa.
                </p>
              </div>
            </div>
          )}

          {/* SEÇÃO PRINCIPAL DE AÇÃO DIRETA (Executar Agora) */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-4 border border-slate-700 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Ação Direta da Etapa {step.number}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">1 Clique para Executar</span>
            </div>

            <div>{renderActionButtons()}</div>
          </div>

          {/* Objetivo */}
          <div className={`${cfg.bg} ${cfg.border} border rounded-2xl p-4`}>
            <p className="text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">🎯 Objetivo da Etapa</p>
            <p className="text-sm text-slate-700 leading-relaxed">{step.description}</p>
          </div>

          {/* Progresso do Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-black text-slate-700 uppercase tracking-wider">📋 Checklist de Evidências</p>
              <span className="text-xs font-bold text-slate-500">{checkedCount}/{totalItems} ({progressPct}%)</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  background: progressPct === 100 ? '#10b981' : progressPct > 50 ? '#f59e0b' : '#64748b'
                }}
              />
            </div>
            <div className="space-y-2">
              {step.checklist.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleItem(idx)}
                  disabled={isBlocked}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    checkedItems[idx]
                      ? 'bg-emerald-50 border-emerald-200'
                      : isBlocked
                      ? 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed'
                      : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  {checkedItems[idx]
                    ? <CheckSquare className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    : <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  }
                  <span className={`text-xs font-medium leading-snug ${checkedItems[idx] ? 'line-through text-emerald-700' : 'text-slate-700'}`}>
                    {item}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Upload de Evidências */}
          <div>
            <p className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">📎 Anexar Evidências</p>
            <button
              onClick={handleFakeUpload}
              disabled={isBlocked}
              className="w-full border-2 border-dashed border-slate-300 rounded-2xl p-4 flex items-center justify-center gap-2 text-slate-500 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              <span className="text-xs font-bold">Clique para anexar documento (PDF, JPG, PNG)</span>
            </button>
            {uploadedFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {uploadedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    <span className="text-xs font-medium text-emerald-700">{file}</span>
                    <span className="text-[9px] text-emerald-500 ml-auto">{new Date().toLocaleDateString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notas */}
          <div>
            <p className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">📝 Observações / Notas</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              disabled={isBlocked}
              placeholder="Adicione observações, riscos identificados ou pendências..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:opacity-40"
            />
          </div>

          {/* Vídeo-aula */}
          <div>
            <p className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">🎬 Vídeo-Aula desta Etapa</p>
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 relative">
              <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                  <div className="w-14 h-14 bg-orange-500/20 border border-orange-500/30 rounded-full flex items-center justify-center mb-3">
                    <Play className="w-6 h-6 text-orange-400 fill-orange-400" />
                  </div>
                  <p className="text-sm font-bold text-white text-center px-4">{step.videoTitle}</p>
                  <p className="text-xs text-slate-400 mt-1">Clique para abrir no YouTube</p>
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(step.videoTitle + ' leilão imóvel')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <Play className="w-3 h-3" /> Assistir Vídeo-Aula
                  </a>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0 bg-slate-50 rounded-b-3xl">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] text-slate-500">
              {status === 'completed' ? 'Etapa concluída com evidência' : `${checkedCount}/${totalItems} itens verificados`}
            </span>
          </div>
          <div className="flex gap-2">
            {status !== 'completed' && (
              <button
                onClick={() => onMarkPending(step.number)}
                disabled={isBlocked}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-100 text-amber-700 border border-amber-200 font-bold text-xs rounded-xl hover:bg-amber-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Marcar Pendente
              </button>
            )}
            <button
              onClick={() => onMarkComplete(step.number)}
              disabled={isBlocked}
              className={`flex items-center gap-1.5 px-4 py-2 font-bold text-xs rounded-xl transition-all ${
                status === 'completed'
                  ? 'bg-slate-200 text-slate-500 cursor-default'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {status === 'completed' ? 'Já Concluída ✓' : 'Concluir Etapa'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
