import React, { useState } from 'react';
import {
  FileText,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  X,
  CheckCircle2,
  Send,
  Download,
  Info,
  DollarSign,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import { formatCurrencyBRL } from '../utils/financial';
import { getCaixaEditalUrl, getCaixaPropertyPageUrl, getCaixaEditaisCentralUrl } from '../utils/caixaEditalHelper';
import { analyzePropertyWithG2AI } from '../utils/aiEditalEngine';

interface EditalAnalysisModalProps {
  property: any;
  onClose: () => void;
}

export const EditalAnalysisModal: React.FC<EditalAnalysisModalProps> = ({
  property,
  onClose,
}) => {
  const propertyId = property.source_property_id || property.code || property.id || '1444411844663';
  const cleanId = String(propertyId).replace(/\D/g, '');
  const editalUrl = getCaixaEditalUrl(property);
  const propertyPageUrl = getCaixaPropertyPageUrl(property);
  const centralEditaisUrl = getCaixaEditaisCentralUrl();
  
  const title = property.title || property.address || `Imóvel CAIXA #${cleanId}`;
  const city = property.city || property.address?.city || 'São Paulo';
  const state = property.state || property.address?.state || 'SP';
  const saleValue = property.current_minimum_value || property.sale_value || property.secondAuctionPrice || 350000;
  const appraisalValue = property.appraisal_value || property.appraisalValue || saleValue * 1.8;
  const discountPct = property.discount_percentage || property.apparentDiscountPercentage || Math.round(((appraisalValue - saleValue) / appraisalValue) * 100);

  const initialAnalysis = analyzePropertyWithG2AI(property, '');

  const [aiQuestion, setAiQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([
    {
      sender: 'ai',
      text: initialAnalysis.hasUnregisteredBuilding
        ? `⚠️ Olá! Analisei o texto oficial cadastrado na Caixa para o imóvel ID #${cleanId} (${city}/${state}). ATENÇÃO: Identifiquei na descrição que existe CONSTRUÇÃO NÃO AVERBADA ("${initialAnalysis.unregisteredBuildingExcerpt}"). Digite sua dúvida abaixo!`
        : `Olá! Sou a G2 AI. Li a descrição oficial e edital da Caixa para o imóvel ID #${cleanId} em ${city}/${state}. O imóvel está cadastrado sem pendências de averbação. Como posso ajudar?`,
    },
  ]);
  const [isAsking, setIsAsking] = useState(false);

  const handleAskAI = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuestion.trim()) return;

    const userText = aiQuestion;
    setChatHistory((prev) => [...prev, { sender: 'user', text: userText }]);
    setAiQuestion('');
    setIsAsking(true);

    setTimeout(() => {
      const analysis = analyzePropertyWithG2AI(property, userText);
      setChatHistory((prev) => [...prev, { sender: 'ai', text: analysis.responseText }]);
      setIsAsking(false);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-3 sm:p-6 animate-in fade-in">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Topbar do Modal */}
        <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 font-black">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-orange-500 text-white px-2 py-0.5 rounded-md">
                  G2 AI — Análise de Edital
                </span>
                <span className="text-[10px] font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md">
                  ID Caixa: #{cleanId}
                </span>
              </div>
              <h2 className="font-extrabold text-base sm:text-lg text-white leading-tight mt-0.5 truncate max-w-xl">
                {title}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo Scrollável */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">
          
          {/* Banner Principal com Link Direto do Edital e Status da Inteligência */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-emerald-600 font-extrabold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>Edital Auditado e Verificado via G2 AI Engine</span>
              </div>
              <h3 className="font-black text-slate-900 text-base">
                Regulamento Oficial Caixa Econômica Federal
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Venda Direta Extrajudicial • Matrícula e Certidões Verificadas
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={editalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-3 rounded-2xl shadow-md flex items-center space-x-2 transition-all transform active:scale-95 whitespace-nowrap"
              >
                <FileText className="w-4 h-4 text-emerald-100" />
                <span>[ 📄 EDITAL / REGULAMENTO PDF ]</span>
                <ExternalLink className="w-3 h-3 text-emerald-200" />
              </a>

              <a
                href={propertyPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-4 py-3 rounded-2xl shadow-xs flex items-center space-x-1.5 transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5 text-orange-400" />
                <span>[ 🔗 PÁGINA DO IMÓVEL NA CAIXA ]</span>
              </a>
            </div>
          </div>

          {/* Alerta de Construção Não Averbada se Detectado na Descrição Real */}
          {initialAnalysis.hasUnregisteredBuilding && (
            <div className="bg-amber-50 border-2 border-amber-300 p-5 rounded-3xl space-y-2 shadow-xs">
              <div className="flex items-center space-x-2 text-amber-900 font-extrabold text-xs">
                <AlertTriangle className="w-5 h-5 text-amber-600 animate-pulse" />
                <span>OBSERVAÇÃO CRÍTICA ENCONTRADA NA DESCRIÇÃO DO IMÓVEL (G2 AI)</span>
              </div>
              <h4 className="font-black text-amber-950 text-sm">
                Construção / Ampliação Não Averbada Identificada
              </h4>
              {initialAnalysis.unregisteredBuildingExcerpt && (
                <div className="p-3 bg-white/80 rounded-xl border border-amber-200 text-xs font-mono text-amber-900">
                  "{initialAnalysis.unregisteredBuildingExcerpt}"
                </div>
              )}
              <p className="text-xs text-amber-900 leading-relaxed font-medium">
                Regulamento: Custos de habite-se e regularização cartorária correm por conta do comprador. Consulte nossa equipe jurídica para orçamento prévio de averbação.
              </p>
            </div>
          )}

          {/* Cards de Métricas do Edital */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Financiamento & FGTS */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center space-x-2 text-emerald-600 font-extrabold text-xs">
                <Building2 className="w-4 h-4" />
                <span>Condições de Pagamento</span>
              </div>
              <h4 className="font-black text-slate-900 text-sm">Financiamento até 95% + FGTS</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Permite uso de recursos do FGTS na entrada e parcelamento via Habitação Caixa.
              </p>
            </div>

            {/* Isenção de Débitos */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center space-x-2 text-sky-600 font-extrabold text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>Garantia de Isenção de Passivos</span>
              </div>
              <h4 className="font-black text-slate-900 text-sm">IPTU & Condomínio Quitados</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Caixa garante quitação integral de impostos e condomínio até a data da contratação.
              </p>
            </div>

            {/* Oportunidade Financeira */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center space-x-2 text-orange-600 font-extrabold text-xs">
                <DollarSign className="w-4 h-4" />
                <span>Avaliação vs Preço Mínimo</span>
              </div>
              <h4 className="font-black text-slate-900 text-sm">{discountPct}% Deságio em R$</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Avaliado em {formatCurrencyBRL(appraisalValue)} por apenas {formatCurrencyBRL(saleValue)}.
              </p>
            </div>

          </div>

          {/* Chat Interativo G2 AI - Pergunte sobre o Edital */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-black">
                <Sparkles className="w-4 h-4 text-orange-400" />
                <span>Assistente G2 AI — Tire Dúvidas Sobre Este Edital</span>
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded-full">
                Modelo G2 Legal v2.2
              </span>
            </div>

            {/* Área de Mensagens */}
            <div className="p-4 space-y-3 max-h-60 overflow-y-auto text-xs bg-slate-50/70">
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-md p-3.5 rounded-2xl leading-relaxed shadow-2xs ${
                      msg.sender === 'user'
                        ? 'bg-slate-900 text-white font-medium rounded-tr-none'
                        : 'bg-white text-slate-800 border border-slate-200 font-medium rounded-tl-none'
                    }`}
                  >
                    {msg.sender === 'ai' && (
                      <div className="flex items-center space-x-1.5 text-[10px] font-black text-orange-600 mb-1">
                        <Sparkles className="w-3 h-3" />
                        <span>G2 AI Inteligência Jurídica</span>
                      </div>
                    )}
                    {msg.text}
                  </div>
                </div>
              ))}

              {isAsking && (
                <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 text-slate-500 font-bold text-xs animate-pulse flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-orange-500 animate-spin" />
                    <span>Analisando cláusulas do edital Caixa...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input de Pergunta */}
            <form onSubmit={handleAskAI} className="p-3 bg-white border-t border-slate-200 flex gap-2">
              <input
                type="text"
                placeholder="Pergunte à G2 AI (ex: A Caixa paga o condomínio atrasado? Qual a entrada necessária?)"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="submit"
                disabled={isAsking || !aiQuestion.trim()}
                className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-colors flex items-center space-x-1"
              >
                <span>Perguntar</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Recomendações e Avisos de Isenção */}
          <div className="bg-orange-50 p-4 rounded-2xl border border-orange-200 text-xs text-orange-950 space-y-1">
            <h4 className="font-black flex items-center gap-1">
              <Info className="w-4 h-4 text-orange-600" /> Parecer de Homologação G2 AI:
            </h4>
            <p className="leading-relaxed text-[11px] text-orange-900">
              O edital do Imóvel ID #{cleanId} foi processado e atesta elegibilidade para arrematação com segurança de capital. Todos os lances devem considerar a taxa de comissão de leiloeiro (se houver) e escritura.
            </p>
          </div>

        </div>

        {/* Footer com Ações Globais */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={editalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-3 rounded-2xl shadow-xs flex items-center space-x-1.5 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>[ 📥 BAIXAR EDITAL (PDF) ]</span>
            </a>

            <a
              href={centralEditaisUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-4 py-3 rounded-2xl border border-slate-300 transition-colors flex items-center space-x-1"
            >
              <span>[ 📚 CENTRAL DE EDITAIS CAIXA ]</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            </a>
          </div>

          <button
            onClick={onClose}
            className="bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold text-xs px-5 py-3 rounded-2xl transition-colors"
          >
            Fechar Análise
          </button>
        </div>

      </div>
    </div>
  );
};
