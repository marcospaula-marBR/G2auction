import React, { useState } from 'react';
import {
  Search, FileText, BookOpen,
  Calculator, Bot,
  Building2, Scale, Home,
  Gavel, Landmark, CreditCard,
  FileCheck, Receipt, Globe, CheckCircle2,
  Building, Users, KeyRound,
  Megaphone, TrendingUp, Handshake,
  ChevronDown, ChevronUp,
} from 'lucide-react';

export type JourneyStepStatus = 'completed' | 'pending' | 'not_started' | 'blocked';

export interface JourneyStep {
  number: number;
  phase: number;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  description: string;
  emoji: string;
  checklist: string[];
  videoTitle: string;
  requires?: number[]; // step numbers that must be completed first
}

export interface JourneyPhase {
  number: number;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  steps: JourneyStep[];
}

export const JOURNEY_STEPS: JourneyStep[] = [
  // FASE 1 — Triagem e Edital
  {
    number: 1, phase: 1, emoji: '🔎', label: '1. Pesquisa do Imóvel', shortLabel: 'Pesquisa',
    icon: Search, videoTitle: 'Como pesquisar imóveis em leilão',
    description: 'Filtrar cidade, tipo, valor de avaliação, desconto, ocupação, liquidez, documentação disponível e objetivo: revenda, locação ou uso próprio.',
    checklist: [
      'Definir cidade e bairros alvo',
      'Definir tipo de imóvel (apto/casa/comercial)',
      'Estabelecer faixa de valor e desconto mínimo',
      'Definir objetivo: revenda, locação ou uso próprio',
      'Verificar disponibilidade de documentação básica',
    ],
  },
  {
    number: 2, phase: 1, emoji: '📄', label: '2. Coleta do Edital', shortLabel: 'Edital',
    icon: FileText, videoTitle: 'Como coletar e organizar o edital',
    description: 'Baixar edital, anexos, laudo, fotos, matrícula, regras da plataforma, comissão, prazo de pagamento e responsabilidade por débitos.',
    checklist: [
      'Download do edital completo',
      'Download de anexos e laudos',
      'Verificar regras da plataforma de leilão',
      'Anotar prazo e forma de pagamento',
      'Identificar comissão do leiloeiro',
      'Confirmar responsabilidade por débitos (comprador ou vendedor)',
    ],
  },
  {
    number: 3, phase: 1, emoji: '📘', label: '3. Análise do Edital', shortLabel: 'Análise',
    icon: BookOpen, videoTitle: 'Como analisar o edital de leilão',
    description: 'Identificar modalidade judicial/extrajudicial, preço mínimo, comissão, caução, prazo, débitos assumidos, ocupação, riscos de cancelamento e penalidades.',
    checklist: [
      'Identificar modalidade (judicial/extrajudicial)',
      'Verificar preço mínimo e valor de avaliação',
      'Checar caução exigida',
      'Mapear débitos assumidos pelo comprador',
      'Avaliar riscos de cancelamento',
      'Ler cláusulas de penalidade por inadimplência',
    ],
  },
  // FASE 2 — Viabilidade Econômica (NOVA POSIÇÃO)
  {
    number: 4, phase: 2, emoji: '💰', label: '4. Viabilidade Financeira', shortLabel: 'Viabilidade',
    icon: Calculator, videoTitle: 'Como calcular a viabilidade financeira',
    description: 'Montar preço-teto somando lance, comissão, ITBI, cartório, débitos, condomínio, reforma, posse, corretagem, tributos e margem mínima.',
    checklist: [
      'Calcular lance estimado',
      'Incluir comissão do leiloeiro',
      'Incluir ITBI + escritura + registro',
      'Mapear débitos assumidos (IPTU, condomínio)',
      'Estimar custo de desocupação/reforma',
      'Calcular corretagem na revenda',
      'Definir margem mínima de lucro',
      'Gerar preço-teto de lance',
    ],
    requires: [1, 2, 3],
  },
  {
    number: 5, phase: 2, emoji: '🤖', label: '5. Parecer por IA', shortLabel: 'Parecer IA',
    icon: Bot, videoTitle: 'Como usar a IA para análise jurídica',
    description: 'Rodar prompt jurídico-financeiro com edital, matrícula e certidões; exigir conclusão objetiva: comprar, comprar com ressalvas ou não comprar.',
    checklist: [
      'Alimentar IA com dados do edital',
      'Alimentar IA com dados da matrícula',
      'Inserir certidões disponíveis',
      'Obter matriz de risco (Baixo/Moderado/Alto)',
      'Obter decisão: Comprar / Ressalvas / Não Comprar',
      'Documentar parecer para o dossiê',
    ],
    requires: [4],
  },
  // FASE 3 — Due Diligence Jurídica
  {
    number: 6, phase: 3, emoji: '🏛️', label: '6. Matrícula Atualizada', shortLabel: 'Matrícula',
    icon: Building2, videoTitle: 'Como analisar a matrícula do imóvel',
    description: 'Solicitar certidão de inteiro teor atualizada e conferir titularidade, ônus, penhoras, hipotecas, alienação fiduciária, indisponibilidades e averbações.',
    checklist: [
      'Solicitar certidão de inteiro teor atualizada',
      'Verificar titularidade atual',
      'Conferir ônus e penhoras',
      'Checar hipotecas e alienação fiduciária',
      'Verificar indisponibilidades',
      'Analisar averbações relevantes',
    ],
  },
  {
    number: 7, phase: 3, emoji: '⚖️', label: '7. Pesquisa Jurídica', shortLabel: 'Jur. Completa',
    icon: Scale, videoTitle: 'Como fazer due diligence jurídica completa',
    description: 'Buscar processos, ações reais/reipersecutórias, execução, embargos, recursos, indisponibilidades, protestos e certidões dos envolvidos.',
    checklist: [
      'Buscar processos judiciais do imóvel',
      'Verificar ações reipersecutórias',
      'Checar execuções e embargos pendentes',
      'Pesquisar indisponibilidades no sistema judicial',
      'Consultar protestos do vendedor/devedor',
      'Obter certidões negativas dos envolvidos',
    ],
  },
  {
    number: 8, phase: 3, emoji: '🏘️', label: '8. Posse e Ocupação', shortLabel: 'Ocupação',
    icon: Home, videoTitle: 'Como avaliar o risco de ocupação',
    description: 'Verificar se o imóvel está ocupado, locado, invadido, abandonado ou com resistência provável; estimar custo de acordo, imissão e desocupação.',
    checklist: [
      'Verificar status de ocupação atual',
      'Identificar tipo de ocupante (inquilino, invasor, ex-proprietário)',
      'Estimar prazo e custo de desocupação',
      'Verificar se há acordo amigável possível',
      'Avaliar necessidade de imissão na posse judicial',
    ],
    requires: [6, 7],
  },
  // FASE 4 — Lance e Arrematação
  {
    number: 9, phase: 4, emoji: '🧾', label: '9. Cadastro e Habilitação', shortLabel: 'Habilitação',
    icon: Landmark, videoTitle: 'Como se cadastrar e habilitar no leilão',
    description: 'Criar conta na plataforma, validar documentos, assinar termos, cadastrar meio de pagamento e acompanhar agenda do leilão.',
    checklist: [
      'Criar conta na plataforma de leilão',
      'Enviar documentos de habilitação (RG, CPF, comprovante)',
      'Assinar termos de uso',
      'Cadastrar meio de pagamento',
      'Confirmar data e horário do leilão',
      'Testar acesso ao sistema de lances',
    ],
    requires: [4, 5, 6, 7, 8],
  },
  {
    number: 10, phase: 4, emoji: '🔨', label: '10. Arrematação', shortLabel: 'Lance',
    icon: Gavel, videoTitle: 'Como dar o lance vencedor no leilão',
    description: 'Dar lance dentro do preço-teto, registrar evidências da sessão, acompanhar auto/ata e cumprir integralmente prazos de pagamento.',
    checklist: [
      'Confirmar preço-teto definido na etapa 4',
      'Participar da sessão de lances',
      'Registrar prints/evidências do leilão',
      'Obter auto de arrematação ou ata',
      'Confirmar prazo para pagamento',
    ],
    requires: [9],
  },
  {
    number: 11, phase: 4, emoji: '🏦', label: '11. Pagamento', shortLabel: 'Pagamento',
    icon: CreditCard, videoTitle: 'Como pagar e guardar comprovantes',
    description: 'Pagar preço, comissão do leiloeiro, guias, custas e demais encargos conforme edital, guardando comprovantes nominalizados.',
    checklist: [
      'Pagar valor do lance no prazo',
      'Pagar comissão do leiloeiro',
      'Pagar guias e custas judiciais',
      'Guardar todos os comprovantes nominalizados',
      'Confirmar recebimento pelo leiloeiro/banco',
    ],
    requires: [10],
  },
  // FASE 5 — Título e Registro
  {
    number: 12, phase: 5, emoji: '🖋️', label: '12. Título Aquisitivo', shortLabel: 'Título',
    icon: FileCheck, videoTitle: 'Como obter o título aquisitivo',
    description: 'Obter carta de arrematação, escritura, contrato ou termo aplicável; conferir qualificação, descrição do imóvel e quitação do preço.',
    checklist: [
      'Solicitar carta de arrematação ao leiloeiro',
      'Verificar qualificação completa no documento',
      'Conferir descrição física do imóvel',
      'Confirmar quitação integral do preço',
    ],
    requires: [11],
  },
  {
    number: 13, phase: 5, emoji: '🏷️', label: '13. ITBI', shortLabel: 'ITBI',
    icon: Receipt, videoTitle: 'Como calcular e pagar o ITBI',
    description: 'Emitir guia municipal quando exigida, validar base de cálculo, prazo, isenção/imunidade se houver e comprovante para registro.',
    checklist: [
      'Verificar se há isenção ou imunidade de ITBI',
      'Emitir guia municipal de ITBI',
      'Validar base de cálculo (valor venal vs. lance)',
      'Pagar dentro do prazo',
      'Guardar comprovante para cartório',
    ],
    requires: [12],
  },
  {
    number: 14, phase: 5, emoji: '🌐', label: '14. Registro Online', shortLabel: 'Registro',
    icon: Globe, videoTitle: 'Como registrar o imóvel online',
    description: 'Protocolar o título no Registro de Imóveis via serviço eletrônico, responder exigências e acompanhar prenotação até registro.',
    checklist: [
      'Protocolar título no RI via serviço eletrônico',
      'Acompanhar número de prenotação',
      'Responder exigências do oficial dentro do prazo',
      'Confirmar registro efetivado',
    ],
    requires: [13],
  },
  {
    number: 15, phase: 5, emoji: '✅', label: '15. Matrícula Efetivada', shortLabel: 'Matrícula Nova',
    icon: CheckCircle2, videoTitle: 'Como verificar a nova matrícula',
    description: 'Obter matrícula atualizada em nome do arrematante, conferir baixa/cancelamento de ônus e corrigir eventuais exigências residuais.',
    checklist: [
      'Obter certidão de inteiro teor pós-registro',
      'Confirmar nome do arrematante como proprietário',
      'Verificar baixa de penhoras e ônus anteriores',
      'Corrigir eventuais exigências residuais',
    ],
    requires: [14],
  },
  // FASE 6 — Regularização Pós-Compra
  {
    number: 16, phase: 6, emoji: '🏙️', label: '16. IPTU e Contribuinte', shortLabel: 'IPTU',
    icon: Building, videoTitle: 'Como regularizar o IPTU',
    description: 'Levantar débitos, negociar se necessário, pagar o que for assumido e alterar cadastro municipal do contribuinte/proprietário.',
    checklist: [
      'Levantar débitos de IPTU junto à prefeitura',
      'Negociar parcelamento se necessário',
      'Pagar os débitos assumidos',
      'Solicitar alteração do cadastro municipal',
      'Obter certidão de quitação municipal',
    ],
    requires: [15],
  },
  {
    number: 17, phase: 6, emoji: '🏢', label: '17. Condomínio', shortLabel: 'Condomínio',
    icon: Users, videoTitle: 'Como regularizar o condomínio',
    description: 'Solicitar extrato à administradora, negociar débitos, atualizar cadastro do proprietário, obter declaração de quitação e boletos futuros.',
    checklist: [
      'Solicitar extrato de débitos à administradora',
      'Negociar débitos condominiais',
      'Pagar débitos acordados',
      'Atualizar cadastro do novo proprietário',
      'Obter declaração de quitação',
    ],
    requires: [15],
  },
  {
    number: 18, phase: 6, emoji: '🔑', label: '18. Posse, Vistoria e Reforma', shortLabel: 'Posse/Reforma',
    icon: KeyRound, videoTitle: 'Como tomar posse e reformar o imóvel',
    description: 'Planejar entrega das chaves, acordo ou medida judicial, vistoriar, religar serviços, limpar, reparar e preparar para comercialização.',
    checklist: [
      'Obter chaves ou ingressar com imissão na posse',
      'Realizar vistoria completa do imóvel',
      'Religar água, luz e gás',
      'Executar limpeza geral',
      'Executar reforma/reparos necessários',
      'Obter laudos e ARTs se necessário',
    ],
    requires: [16, 17],
  },
  // FASE 7 — Revenda e Encerramento
  {
    number: 19, phase: 7, emoji: '📣', label: '19. Revenda com Corretores', shortLabel: 'Revenda',
    icon: Megaphone, videoTitle: 'Como vender o imóvel com corretores',
    description: 'Definir preço de saída, margem, contrato de corretagem, comissão pactuada, estratégia de anúncios, visitas e gestão de propostas.',
    checklist: [
      'Definir preço de saída',
      'Contratar corretor(es) e assinar contrato de corretagem',
      'Definir estratégia de anúncios (portais, redes sociais)',
      'Fotografar o imóvel profissionalmente',
      'Publicar anúncio nos portais',
      'Gerir visitas e propostas',
    ],
    requires: [18],
  },
  {
    number: 20, phase: 7, emoji: '🧮', label: '20. Ganho de Capital', shortLabel: 'GCAP',
    icon: TrendingUp, videoTitle: 'Como calcular e recolher o ganho de capital',
    description: 'Apurar ganho no GCAP, recolher imposto quando devido, guardar documentos de custo de aquisição, benfeitorias e venda.',
    checklist: [
      'Apurar ganho de capital no programa GCAP',
      'Calcular custo de aquisição total (lance + todos os custos)',
      'Incluir benfeitorias documentadas',
      'Calcular imposto de renda devido',
      'Emitir DARF e recolher até último dia do mês seguinte',
      'Guardar declaração GCAP para IR anual',
    ],
    requires: [19],
  },
  {
    number: 21, phase: 7, emoji: '🤝', label: '21. Fechamento Final', shortLabel: 'Encerramento',
    icon: Handshake, videoTitle: 'Como encerrar a operação com dossiê',
    description: 'Assinar venda, receber valores, registrar transferência ao comprador, arquivar dossiê, calcular resultado final e encerrar operação.',
    checklist: [
      'Assinar escritura de venda',
      'Receber valores (TED, depósito judicial, etc.)',
      'Acompanhar registro em nome do comprador',
      'Calcular resultado líquido final da operação',
      'Arquivar dossiê completo',
      'Encerrar operação no sistema G2',
    ],
    requires: [20],
  },
];

export const JOURNEY_PHASES: JourneyPhase[] = [
  { number: 1, label: 'Triagem e Edital', color: 'text-sky-700', bgColor: 'bg-sky-50', borderColor: 'border-sky-200', steps: JOURNEY_STEPS.filter(s => s.phase === 1) },
  { number: 2, label: 'Viabilidade Econômica', color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', steps: JOURNEY_STEPS.filter(s => s.phase === 2) },
  { number: 3, label: 'Due Diligence Jurídica', color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', steps: JOURNEY_STEPS.filter(s => s.phase === 3) },
  { number: 4, label: 'Lance e Arrematação', color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', steps: JOURNEY_STEPS.filter(s => s.phase === 4) },
  { number: 5, label: 'Título e Registro', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', steps: JOURNEY_STEPS.filter(s => s.phase === 5) },
  { number: 6, label: 'Regularização Pós-Compra', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', steps: JOURNEY_STEPS.filter(s => s.phase === 6) },
  { number: 7, label: 'Revenda e Encerramento', color: 'text-rose-700', bgColor: 'bg-rose-50', borderColor: 'border-rose-200', steps: JOURNEY_STEPS.filter(s => s.phase === 7) },
];

const PHASE_ACCENT: Record<number, string> = {
  1: 'bg-sky-500', 2: 'bg-emerald-500', 3: 'bg-purple-500',
  4: 'bg-orange-500', 5: 'bg-blue-500', 6: 'bg-amber-500', 7: 'bg-rose-500',
};

const STATUS_DOT: Record<JourneyStepStatus, string> = {
  completed: 'bg-emerald-500 ring-emerald-200',
  pending: 'bg-amber-400 ring-amber-200',
  not_started: 'bg-slate-300 ring-slate-100',
  blocked: 'bg-red-400 ring-red-200',
};

interface JourneyTimelineProps {
  stepStatuses: Record<number, JourneyStepStatus>;
  onSelectStep: (step: JourneyStep) => void;
}

export const JourneyTimeline: React.FC<JourneyTimelineProps> = ({ stepStatuses, onSelectStep }) => {
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);

  const getPhaseStatus = (phase: JourneyPhase): JourneyStepStatus => {
    const statuses = phase.steps.map(s => stepStatuses[s.number] ?? 'not_started');
    if (statuses.every(s => s === 'completed')) return 'completed';
    if (statuses.some(s => s === 'pending')) return 'pending';
    if (statuses.some(s => s === 'completed')) return 'pending';
    return 'not_started';
  };

  return (
    <div className="bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 py-2">
        {/* Header label */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            🗺️ Jornada do Arrematante — 21 Etapas · 7 Fases
          </span>
          <div className="flex items-center gap-3 text-[9px] font-bold">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Concluída</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>Pendente</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block"/>Não Iniciada</span>
          </div>
        </div>

        {/* Phase pills row — Grid Responsivo de 7 Fases para NUNCA cortar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 py-1">
          {JOURNEY_PHASES.map((phase, idx) => {
            const phaseStatus = getPhaseStatus(phase);
            const isExpanded = expandedPhase === phase.number;

            return (
              <button
                key={phase.number}
                onClick={() => setExpandedPhase(isExpanded ? null : phase.number)}
                className={`w-full flex items-center justify-between gap-1 px-2.5 py-2 rounded-xl border text-[11px] font-black transition-all text-left ${
                  phaseStatus === 'completed'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
                    : isExpanded
                    ? `${phase.bgColor} ${phase.borderColor} ${phase.color} shadow-xs ring-2 ring-orange-400/40`
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                }`}
                title={`Fase ${phase.number}: ${phase.label} (${phase.steps.length} etapas)`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[phaseStatus]}`} />
                  <span className="truncate">{idx + 1}. {phase.label}</span>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <span className="text-[9px] opacity-60">({phase.steps.length})</span>
                  {isExpanded ? <ChevronUp className="w-3 h-3 opacity-70" /> : <ChevronDown className="w-3 h-3 opacity-70" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Expanded phase steps */}
        {expandedPhase !== null && (() => {
          const phase = JOURNEY_PHASES.find(p => p.number === expandedPhase)!;
          return (
            <div className={`mt-2 p-3 rounded-2xl border ${phase.bgColor} ${phase.borderColor} animate-in slide-in-from-top-1 duration-200`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-1.5 h-4 rounded-full ${PHASE_ACCENT[phase.number]}`} />
                <span className={`text-xs font-black ${phase.color}`}>Fase {phase.number}: {phase.label}</span>
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                {phase.steps.map(step => {
                  const status = stepStatuses[step.number] ?? 'not_started';
                  const Icon = step.icon;
                  const isBlocked = step.requires && step.requires.some(r => (stepStatuses[r] ?? 'not_started') !== 'completed');

                  return (
                    <button
                      key={step.number}
                      onClick={() => onSelectStep(step)}
                      className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all min-w-[140px] ${
                        status === 'completed'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : status === 'pending'
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : isBlocked
                          ? 'bg-slate-50 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:shadow-sm'
                      }`}
                      title={isBlocked ? 'Complete as etapas anteriores primeiro' : step.description}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        status === 'completed' ? 'bg-emerald-200 text-emerald-800'
                        : status === 'pending' ? 'bg-amber-200 text-amber-800'
                        : 'bg-slate-100 text-slate-500'
                      }`}>
                        {status === 'completed'
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          : <Icon className="w-4 h-4" />
                        }
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[status]}`} />
                          <span className="text-[10px] font-black leading-tight">{step.shortLabel}</span>
                        </div>
                        <span className="text-[9px] opacity-60 block">{step.emoji} Etapa {step.number}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
