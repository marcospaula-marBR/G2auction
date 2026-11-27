import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sparkles,
  FileText,
  Printer,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  TrendingUp,
  MapPin,
  ShieldCheck,
  Clock,
  Award,
  Building2,
  Globe,
  BarChart3,
  History,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useTenant } from '../config/tenant';
import { useAuth } from '../config/auth';
import { formatCurrencyBRL } from '../utils/financial';
import {
  generateAiInvestmentReport,
  saveAiReportToHistory,
  loadAiReportsHistory,
  deleteAiReportFromHistory,
  type AiReportStrategy,
  type AiPaymentMode,
  type AiInvestmentReport,
  type SavedAiReportRecord,
} from '../utils/aiInvestmentReportService';
import { openAiInvestmentReportPdf } from '../utils/aiReportPdfExporter';

interface AiInvestmentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProperties: any[];
  onRemoveProperty: (propertyId: string) => void;
  onClearSelection?: () => void;
}

type ModalTab = 'setup' | 'report' | 'history';
type ScenarioView = 'conservative' | 'base' | 'optimistic';

export const AiInvestmentReportModal: React.FC<AiInvestmentReportModalProps> = ({
  isOpen,
  onClose,
  selectedProperties,
  onRemoveProperty,
  onClearSelection,
}) => {
  const { tenant } = useTenant();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<ModalTab>(selectedProperties.length > 0 ? 'setup' : 'history');
  const [strategy, setStrategy] = useState<AiReportStrategy>('FLIPPING');
  const [paymentMode, setPaymentMode] = useState<AiPaymentMode>('CASH');
  const [targetRoiPct, setTargetRoiPct] = useState<number>(30);
  const [holdingMonths, setHoldingMonths] = useState<number>(10);
  const [customNotes, setCustomNotes] = useState<string>('');

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progressStep, setProgressStep] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState<AiInvestmentReport | null>(null);
  const [scenarioView, setScenarioView] = useState<ScenarioView>('base');

  const [historyList, setHistoryList] = useState<SavedAiReportRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setSavedNotice(null);
    if (selectedProperties.length === 0 && !activeReport) {
      setActiveTab('history');
    } else if (selectedProperties.length > 0 && !activeReport) {
      setActiveTab('setup');
    }
    setLoadingHistory(true);
    loadAiReportsHistory(user?.id, user?.isDemoSession)
      .then(setHistoryList)
      .finally(() => setLoadingHistory(false));
  }, [isOpen, selectedProperties.length, user?.id, user?.isDemoSession]);

  const roiChartData = useMemo(() => {
    if (!activeReport) return [];
    const cdiRef = activeReport.bcbBenchmark.cdiAnnualPct;
    return activeReport.properties.map((p) => {
      const scen = p.financial.scenarios[scenarioView];
      const shortName = `#${p.rank} ${p.city?.slice(0, 12) || p.sourcePropertyId}`;
      return {
        name: shortName,
        'ROI Líquido (%)': scen.roiPct,
        'TIR Anual (%)': scen.irrAnnualPct,
        'CDI BCB (% a.a.)': cdiRef,
      };
    });
  }, [activeReport, scenarioView]);

  const priceM2ChartData = useMemo(() => {
    if (!activeReport) return [];
    return activeReport.properties
      .filter((p) => p.financial.bidPerM2 || p.financial.appraisalPerM2 || p.estimatedMarketPricePerM2)
      .map((p) => ({
        name: `#${p.rank} ${p.neighborhood?.slice(0, 14) || p.city}`,
        'Lance (R$/m²)': p.financial.bidPerM2 || 0,
        'Avaliação Banco (R$/m²)': p.financial.appraisalPerM2 || 0,
        'Mercado IA (R$/m²)': p.estimatedMarketPricePerM2 || p.financial.marketPerM2 || 0,
      }));
  }, [activeReport]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (selectedProperties.length === 0 || isGenerating) return;
    setIsGenerating(true);
    setErrorMsg(null);
    setSavedNotice(null);

    const steps = [
      'Consultando CDI/IPCA (Banco Central) e dados IBGE das cidades...',
      'Cruzando comparáveis internos na base G2Auction...',
      'Pesquisando mercado atual via Gemini + Google Search Grounding...',
      'Consolidando matriz financeira em 3 cenários e parecer do Comitê...',
    ];
    let stepIdx = 0;
    setProgressStep(steps[0]);
    const timer = window.setInterval(() => {
      stepIdx = Math.min(steps.length - 1, stepIdx + 1);
      setProgressStep(steps[stepIdx]);
    }, 2800);

    try {
      const report = await generateAiInvestmentReport({
        properties: selectedProperties,
        strategy,
        paymentMode,
        targetRoiPct,
        holdingMonths,
        customNotes: customNotes.trim() || undefined,
      });

      setActiveReport(report);
      setActiveTab('report');

      const saved = await saveAiReportToHistory(
        report,
        user?.id,
        tenant.id,
        user?.isDemoSession
      );
      setHistoryList((prev) => [saved, ...prev.filter((r) => r.id !== saved.id)]);
      setSavedNotice('Relatório salvo automaticamente no seu histórico.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao gerar relatório com IA.');
    } finally {
      window.clearInterval(timer);
      setIsGenerating(false);
      setProgressStep('');
    }
  };

  const handleDeleteHistory = async (id: string) => {
    await deleteAiReportFromHistory(id, user?.id, user?.isDemoSession);
    setHistoryList((prev) => prev.filter((r) => r.id !== id));
  };

  const verdictStyle = (verdict: string) => {
    if (verdict === 'COMPRAR') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (verdict === 'EVITAR') return 'bg-red-100 text-red-800 border-red-300';
    return 'bg-amber-100 text-amber-900 border-amber-300';
  };

  const verdictLabel = (verdict: string) => {
    if (verdict === 'COMPRAR') return 'COMPRAR';
    if (verdict === 'EVITAR') return 'EVITAR';
    return 'ESTUDAR C/ RESSALVAS';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm p-2 sm:p-4 flex items-center justify-center overflow-y-auto">
      <div className="bg-white w-full max-w-6xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 sm:px-7 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md"
              style={{
                background: `linear-gradient(135deg, ${tenant.primaryColor}, ${tenant.accentColor})`,
              }}
            >
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Comitê de Inteligência IA — Relatório Comparativo
              </h2>
              <p className="text-[11px] text-slate-300">
                Pesquisa Web ao vivo (Gemini) · IBGE · CDI/IPCA BCB · Comparáveis G2 · Cenários Financeiros & PDF White-Label
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('setup')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                  activeTab === 'setup' ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'
                }`}
              >
                Configurar ({selectedProperties.length})
              </button>
              {activeReport && (
                <button
                  type="button"
                  onClick={() => setActiveTab('report')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                    activeTab === 'report' ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Relatório Atual
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors ${
                  activeTab === 'history' ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Histórico ({historyList.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs bg-slate-50/50">
          {/* ABA 1: CONFIGURAR & GERAR */}
          {activeTab === 'setup' && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-orange-600" />
                    <span>Imóveis Selecionados para Comparação ({selectedProperties.length}/6)</span>
                  </h3>
                  {selectedProperties.length > 0 && onClearSelection && (
                    <button
                      type="button"
                      onClick={onClearSelection}
                      className="text-[11px] font-bold text-slate-500 hover:text-red-600"
                    >
                      Limpar seleção
                    </button>
                  )}
                </div>

                {selectedProperties.length === 0 ? (
                  <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-6 text-center space-y-2">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-bold text-slate-700">Nenhum imóvel selecionado no catálogo ainda.</p>
                    <p className="text-[11px] text-slate-500">
                      Clique em <strong>"+ Relatório IA"</strong> nos cards do catálogo (entre 1 e 6 imóveis) para comparar cidades, valores/m², riscos e potencial de ganho.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {selectedProperties.map((p, idx) => {
                      const key = String(p.id || p.source_property_id || idx);
                      const minVal = Number(p.current_minimum_value || p.sale_value || 0);
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-500">
                              <span className="text-orange-600">{p.source || 'CAIXA'}</span>
                              <span>·</span>
                              <span>{p.city}/{p.state}</span>
                              {p.neighborhood && <span>· {p.neighborhood}</span>}
                            </div>
                            <p className="font-bold text-slate-900 truncate">{p.title || p.address || key}</p>
                            <p className="text-[11px] text-emerald-700 font-black">
                              {minVal > 0 ? formatCurrencyBRL(minVal) : 'Sob Consulta'}
                              {p.appraisal_value ? ` · Aval: ${formatCurrencyBRL(p.appraisal_value)}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemoveProperty(key)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                            title="Remover imóvel"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Parâmetros */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
                <h3 className="font-black text-slate-900 text-sm">Parâmetros da Análise do Investidor</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">Estratégia</label>
                    <select
                      value={strategy}
                      onChange={(e) => setStrategy(e.target.value as AiReportStrategy)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800"
                    >
                      <option value="FLIPPING">Flipping (Revenda Rápida)</option>
                      <option value="RENTAL">Renda Passiva (Aluguel)</option>
                      <option value="LIVING">Moradia / Patrimônio</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">Forma de Compra</label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as AiPaymentMode)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800"
                    >
                      <option value="CASH">À Vista (Recursos Próprios)</option>
                      <option value="FINANCED">Financiado (Quando Aceito)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">ROI Líquido Alvo (%)</label>
                    <input
                      type="number"
                      min={5}
                      max={120}
                      value={targetRoiPct}
                      onChange={(e) => setTargetRoiPct(Number(e.target.value || 30))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">Prazo Estimado (Meses)</label>
                    <input
                      type="number"
                      min={3}
                      max={60}
                      value={holdingMonths}
                      onChange={(e) => setHoldingMonths(Number(e.target.value || 10))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">
                    Direcionamento / Pergunta Adicional para a IA (Opcional)
                  </label>
                  <input
                    type="text"
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="Ex: Priorizar imóveis desocupados próximos a metrô ou com potencial de aluguel acima de R$ 2.500..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-medium text-slate-800"
                  />
                </div>

                {errorMsg && (
                  <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {isGenerating && (
                  <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-2xl p-4 flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
                    <div>
                      <span className="font-black block">Processando Inteligência Comparativa...</span>
                      <span className="text-[11px] text-indigo-700">{progressStep}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={selectedProperties.length === 0 || isGenerating}
                    onClick={handleGenerate}
                    className="px-6 py-3 rounded-2xl text-white font-black text-xs shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    style={{
                      background: `linear-gradient(135deg, ${tenant.primaryColor}, ${tenant.accentColor})`,
                    }}
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>
                      {isGenerating
                        ? 'Gerando Relatório IA...'
                        : `Gerar Relatório de Inteligência IA (${selectedProperties.length})`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: RELATÓRIO GERADO */}
          {activeTab === 'report' && activeReport && (
            <div className="space-y-5">
              {/* Barra de Ações do Relatório */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-full font-black text-[10px] border flex items-center gap-1 ${
                      activeReport.usedWebGrounding
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : activeReport.aiMode === 'GEMINI_LIVE'
                        ? 'bg-sky-50 text-sky-800 border-sky-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    <Globe className="w-3 h-3" />
                    <span>
                      {activeReport.usedWebGrounding
                        ? `Gemini + Google Search ao Vivo (${activeReport.modelUsed})`
                        : activeReport.aiMode === 'GEMINI_LIVE'
                        ? `Gemini IA (${activeReport.modelUsed})`
                        : 'Motor Determinístico Local (configure GEMINI_API_KEY)'}
                    </span>
                  </span>

                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] border border-slate-200">
                    CDI BCB: {activeReport.bcbBenchmark.cdiAnnualPct}% a.a. · IPCA 12m: {activeReport.bcbBenchmark.ipca12mPct}%
                  </span>

                  {savedNotice && (
                    <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {savedNotice}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openAiInvestmentReportPdf(activeReport, tenant)}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5 text-orange-400" />
                    <span>Exportar PDF White-Label</span>
                  </button>
                </div>
              </div>

              {/* Sumário Executivo */}
              <div
                className="rounded-3xl border p-5 sm:p-6 bg-white space-y-3 shadow-xs"
                style={{ borderColor: `${tenant.primaryColor}40` }}
              >
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider" style={{ color: tenant.primaryColor }}>
                  <Award className="w-4 h-4" />
                  <span>Veredito Executivo do Comitê IA</span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
                  {activeReport.executiveSummary?.headline}
                </h3>
                {activeReport.executiveSummary?.bestPickReason && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-emerald-950 font-medium">
                    <strong className="font-black text-emerald-800 block text-[11px] uppercase mb-0.5">
                      🏆 Melhor Escolha Recomendada:
                    </strong>
                    {activeReport.executiveSummary.bestPickReason}
                  </div>
                )}
                <p className="text-slate-700 leading-relaxed">{activeReport.executiveSummary?.committeeOverview}</p>
                <p className="text-slate-800 font-bold bg-slate-50 border border-slate-200 rounded-xl p-3">
                  📌 {activeReport.executiveSummary?.portfolioRecommendation}
                </p>
              </div>

              {/* Gráficos Comparativos Recharts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-black text-slate-900 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      <span>Retorno Projetado vs. CDI Oficial (%)</span>
                    </h4>
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                      {(
                        [
                          { id: 'conservative', label: 'Conserv.' },
                          { id: 'base', label: 'Base' },
                          { id: 'optimistic', label: 'Otimista' },
                        ] as { id: ScenarioView; label: string }[]
                      ).map((sc) => (
                        <button
                          key={sc.id}
                          type="button"
                          onClick={() => setScenarioView(sc.id)}
                          className={`px-2 py-1 rounded-md ${
                            scenarioView === sc.id ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                          }`}
                        >
                          {sc.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={roiChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} unit="%" />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar dataKey="ROI Líquido (%)" fill="#059669" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="TIR Anual (%)" fill="#2563eb" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="CDI BCB (% a.a.)" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                  <h4 className="font-black text-slate-900 flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-orange-600" />
                    <span>Comparativo de Preço por m² (R$/m²)</span>
                  </h4>
                  {priceM2ChartData.length > 0 ? (
                    <div className="h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={priceM2ChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: any) => formatCurrencyBRL(Number(v))} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          <Bar dataKey="Lance (R$/m²)" fill="#059669" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="Avaliação Banco (R$/m²)" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="Mercado IA (R$/m²)" fill="#6366f1" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-60 flex items-center justify-center text-slate-400 text-center px-4">
                      Área em m² não informada na origem para gerar gráfico por m². Consulte os valores absolutos na matriz abaixo.
                    </div>
                  )}
                </div>
              </div>

              {/* Análise de Cidade e Região */}
              {activeReport.regionAnalyses?.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-orange-600" />
                    <span>Inteligência da Cidade & Microrregião (IBGE + Pesquisa Web IA)</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeReport.regionAnalyses.map((reg, idx) => (
                      <div key={`${reg.city}-${idx}`} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-slate-900 text-sm">
                            {reg.city} / {reg.uf}
                          </span>
                          <span
                            className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                              reg.liquidityRating === 'ALTA'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : reg.liquidityRating === 'BAIXA'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            Liquidez {reg.liquidityRating}
                          </span>
                        </div>

                        {reg.pricePerM2RangeBrl && (
                          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-400 block">Mín/m²</span>
                              <span className="font-black text-slate-800">
                                {formatCurrencyBRL(reg.pricePerM2RangeBrl.min)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-400 block">Média/m²</span>
                              <span className="font-black text-indigo-700">
                                {formatCurrencyBRL(reg.pricePerM2RangeBrl.avg)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-400 block">Máx/m²</span>
                              <span className="font-black text-slate-800">
                                {formatCurrencyBRL(reg.pricePerM2RangeBrl.max)}
                              </span>
                            </div>
                          </div>
                        )}

                        <p className="text-slate-700 leading-relaxed">{reg.macroOverview}</p>
                        <p className="text-slate-600">
                          <strong className="text-slate-900">Bairros & Demanda:</strong> {reg.neighborhoodInsights}
                        </p>
                        <p className="text-slate-600">
                          <strong className="text-slate-900">Tendências:</strong> {reg.marketTrends}
                        </p>
                        {reg.economicDrivers?.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {reg.economicDrivers.map((drv, i) => (
                              <span key={i} className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg font-semibold text-slate-700">
                                • {drv}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fichas Comparativas Detalhadas */}
              <div className="space-y-4">
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Ranking, Potencial de Ganho, Riscos & Conferência nos Portais</span>
                </h4>

                {activeReport.properties.map((p) => {
                  const scen = p.financial.scenarios[scenarioView];
                  return (
                    <div key={p.propertyId} className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="bg-slate-900 text-white font-black text-[11px] px-2.5 py-0.5 rounded-lg">
                              #{p.rank}
                            </span>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              {p.source} · {p.sourcePropertyId}
                            </span>
                            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${verdictStyle(p.verdict)}`}>
                              {verdictLabel(p.verdict)}
                            </span>
                            <span className="text-[11px] font-black text-indigo-700">
                              Score IA: {p.aiScore}/100
                            </span>
                          </div>
                          <h5 className="text-base font-black text-slate-900">{p.title}</h5>
                          <p className="text-[11px] text-slate-500 font-semibold">
                            {p.address || `${p.city}/${p.state}`}
                            {p.neighborhood ? ` · Bairro: ${p.neighborhood}` : ''}
                            {p.financial.areaM2 ? ` · ${p.financial.areaM2} m²` : ''}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Lance Máximo Seguro</span>
                          <span className="text-lg font-black text-emerald-600">
                            {formatCurrencyBRL(p.financial.maxSafeBid)}
                          </span>
                          <span className={`text-[10px] font-bold block ${p.financial.bidHeadroomBrl >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            {p.financial.bidHeadroomBrl >= 0
                              ? `Folga de ${formatCurrencyBRL(p.financial.bidHeadroomBrl)} acima do mínimo`
                              : `Mínimo ${formatCurrencyBRL(Math.abs(p.financial.bidHeadroomBrl))} acima do teto`}
                          </span>
                        </div>
                      </div>

                      {p.falseDiscountAlert?.flagged && (
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-red-900 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <div>
                            <strong className="font-black block text-[11px] uppercase">
                              Alerta de Falso Deságio / Margem Apertada
                            </strong>
                            <span>{p.falseDiscountAlert.reason}</span>
                          </div>
                        </div>
                      )}

                      {/* KPIs Financeiros do Cenário Selecionado */}
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                        <div>
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">Lance Mínimo</span>
                          <span className="font-black text-slate-900">{formatCurrencyBRL(p.financial.effectiveBid)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">Mercado Est. (IA)</span>
                          <span className="font-black text-indigo-700">{formatCurrencyBRL(p.estimatedMarketValue)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">Capital Total</span>
                          <span className="font-black text-slate-800">{formatCurrencyBRL(scen.totalInvested)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">Lucro Líq. ({scenarioView})</span>
                          <span className={`font-black ${scen.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrencyBRL(scen.netProfit)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">ROI / TIR Anual</span>
                          <span className="font-black text-emerald-700">
                            {scen.roiPct}% / {scen.irrAnnualPct}%
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">Aluguel / Yield</span>
                          <span className="font-black text-slate-800">
                            {formatCurrencyBRL(p.estimatedMonthlyRent)}/mês ({p.financial.grossRentalYieldAnnualPct}%)
                          </span>
                        </div>
                      </div>

                      <p className="text-slate-700 leading-relaxed">
                        <strong className="text-slate-900">Comparativo de Mercado:</strong> {p.marketComparisonSummary}
                        {p.comparables.cityActiveCount > 0 && (
                          <span className="text-slate-500">
                            {' '}
                            (Base G2: {p.comparables.cityActiveCount} ativos na cidade
                            {p.comparables.neighborhoodAvgAppraisalPerM2
                              ? ` · média avaliação bairro ${formatCurrencyBRL(p.comparables.neighborhoodAvgAppraisalPerM2)}/m²`
                              : ''}
                            )
                          </span>
                        )}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3 space-y-1">
                          <span className="font-black text-emerald-900 text-[10px] uppercase block">Pontos Fortes</span>
                          <ul className="space-y-1 text-emerald-950">
                            {p.pros.map((item, i) => (
                              <li key={i}>• {item}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3 space-y-1">
                          <span className="font-black text-amber-900 text-[10px] uppercase block">Riscos & Atenção</span>
                          <ul className="space-y-1 text-amber-950">
                            {p.cons.map((item, i) => (
                              <li key={i}>• {item}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-1">
                          <span className="font-black text-slate-800 text-[10px] uppercase block">Checklist Pré-Lance</span>
                          <ul className="space-y-1 text-slate-700">
                            {p.legalDiligenceChecklist.map((item, i) => (
                              <li key={i}>✓ {item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 text-indigo-950">
                        <strong className="font-black">🎯 Estratégia Recomendada:</strong> {p.biddingStrategy}
                      </div>

                      {/* Deep Links 1-Clique nos Portais */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-[10px] font-black uppercase text-slate-500 mr-1">
                          Conferir anúncios reais na região:
                        </span>
                        <a
                          href={p.portalLinks.zapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-bold text-[11px] inline-flex items-center gap-1"
                        >
                          <span>ZAP Imóveis</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                          href={p.portalLinks.vivaRealUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 font-bold text-[11px] inline-flex items-center gap-1"
                        >
                          <span>VivaReal</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                          href={p.portalLinks.quintoAndarUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-[11px] inline-flex items-center gap-1"
                        >
                          <span>QuintoAndar</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                          href={p.portalLinks.olxUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-bold text-[11px] inline-flex items-center gap-1"
                        >
                          <span>OLX Imóveis</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                          href={p.portalLinks.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[11px] inline-flex items-center gap-1"
                        >
                          <span>Google Maps</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Fontes Web Consultadas */}
              {activeReport.webSources?.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
                  <h4 className="font-black text-slate-900 flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-emerald-600" />
                    <span>Fontes Web Consultadas ao Vivo pelo Gemini ({activeReport.webSources.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {activeReport.webSources.map((src, idx) => (
                      <a
                        key={idx}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-sky-700 hover:underline flex items-center gap-1 truncate"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">{src.title || src.url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ABA 3: HISTÓRICO SALVO */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {loadingHistory ? (
                <div className="py-12 flex items-center justify-center gap-2 text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Carregando histórico de relatórios...</span>
                </div>
              ) : historyList.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-700">Nenhum relatório salvo ainda.</p>
                  <p className="text-[11px] text-slate-500">
                    Selecione de 1 a 6 imóveis no catálogo e gere seu primeiro Relatório Comparativo IA.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {historyList.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-black text-slate-900 truncate">{item.title}</p>
                        <p className="text-[11px] text-slate-500">
                          {new Date(item.created_at).toLocaleString('pt-BR')} · {item.properties_count} imóvel(is) ·{' '}
                          {item.strategy} · {item.used_web_grounding ? 'Pesquisa Web ao Vivo' : item.model_used || 'IA'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveReport(item.report_payload);
                            setActiveTab('report');
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
                        >
                          Abrir Relatório
                        </button>
                        <button
                          type="button"
                          onClick={() => openAiInvestmentReportPdf(item.report_payload, tenant)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteHistory(item.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                          title="Excluir do histórico"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
