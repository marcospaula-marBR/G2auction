import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Sparkles, Bot, ShieldCheck, X, ArrowRight, Info } from 'lucide-react';
import type { Property, ProvenanceType } from '../types/auction';
import { formatCurrencyBRL, calculateMaxBid } from '../utils/financial';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  provenance?: ProvenanceType;
  actionableProperty?: Property;
  financialData?: any;
}

interface AICopilotProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  onSelectProperty: (property: Property) => void;
  onRegisterVoiceExpense?: (text: string) => void;
}

export const AICopilot: React.FC<AICopilotProps> = ({
  isOpen,
  onClose,
  properties,
  onSelectProperty,
  onRegisterVoiceExpense,
}) => {
  const [inputQuery, setInputQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Olá! Sou o Copilot de IA do G2 AUCTION. Como posso ajudar seu investimento hoje? Você pode pedir sugestões de imóveis com alto deságio, analisar riscos de edital, calcular seu lance máximo ou registrar despesas por voz em português.',
      timestamp: 'Agora',
      provenance: 'DADO OFICIAL',
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Web Speech API - Recognition (Voz pt-BR)
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Seu navegador não suporta a Web Speech API para voz nativa. Você pode digitar sua pergunta!');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputQuery(transcript);
        handleSend(transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  // Web Speech API - Speech Synthesis (pt-BR)
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;

    window.speechSynthesis.speak(utterance);
  };

  const handleSend = (overrideQuery?: string) => {
    const query = (overrideQuery || inputQuery).trim();
    if (!query) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!overrideQuery) setInputQuery('');

    // Processamento Inteligente com Lógica Determinística + IA
    setTimeout(() => {
      processAiResponse(query);
    }, 600);
  };

  const processAiResponse = (query: string) => {
    const lower = query.toLowerCase();
    let responseText = '';
    let provenance: ProvenanceType = 'ESTIMATIVA IA';
    let targetProp: Property | undefined;
    let financialData: any = null;

    if (lower.includes('campinas') || lower.includes('deságio') || lower.includes('encontre') || lower.includes('300') || lower.includes('500')) {
      targetProp = properties.find((p) => p.address.city.toLowerCase().includes('campinas')) || properties[0];
      provenance = 'CONFIRMADO';
      responseText = `Encontrei uma oportunidade excelente no bairro ${targetProp.address.neighborhood} em ${targetProp.address.city}. O imóvel avaliado em ${formatCurrencyBRL(targetProp.appraisalValue)} está com lance mínimo na 2ª praça de ${formatCurrencyBRL(targetProp.secondAuctionPrice)}, representando um deságio aparente de ${targetProp.apparentDiscountPercentage}%. O leiloeiro oficial é ${targetProp.auctioneerName} (com selo Antifraude verificado).`;
    } else if (lower.includes('lance máximo') || lower.includes('lance maximo') || lower.includes('quanto devo pagar') || lower.includes('lance limite')) {
      targetProp = properties[0];
      provenance = 'DADO OFICIAL';
      const calc = calculateMaxBid({
        expectedMarketValue: targetProp.estimatedMarketPrice,
        renovationEstimate: targetProp.renovationEstimate,
        debtsToPay: targetProp.debts.iptu + targetProp.debts.condominium,
        targetRoiPercent: 30,
        holdingMonths: 10,
      });

      financialData = calc;
      responseText = `Para garantir um ROI alvo de 30% em 10 meses no imóvel do Cambuí, seu Lance Máximo Racional é de ${formatCurrencyBRL(calc.maxBidPrice)}. Seu desembolso total estimado será de ${formatCurrencyBRL(calc.totalInvestment)}, resultando em um Lucro Líquido Esperado de ${formatCurrencyBRL(calc.expectedNetProfit)} (TIR Anualizada de ${calc.actualIrrAnnual}%).`;
    } else if (lower.includes('paguei') || lower.includes('pedreiro') || lower.includes('reforma') || lower.includes('despesa') || lower.includes('gastei')) {
      provenance = 'CONFIRMADO';
      onRegisterVoiceExpense?.(query);
      responseText = `Lançamento compreendido e adicionado ao Livro Caixa com sucesso! Registrei a despesa para a categoria "Mão de Obra Reforma" vinculada ao imóvel selecionado. Os cálculos de rentabilidade real foram atualizados deterministicamente.`;
    } else if (lower.includes('segurança') || lower.includes('crime') || lower.includes('enchente') || lower.includes('risco')) {
      targetProp = properties[0];
      provenance = 'DADO OFICIAL';
      responseText = `Com base nos dados públicos de Segurança Pública de SP e CEMADEN, o imóvel em ${targetProp.address.neighborhood} possui Índice de Segurança de ${targetProp.safetyIndex.score}/10 (${targetProp.safetyIndex.level}) e Risco Hidrológico ${targetProp.floodRisk.level}. O imóvel está a ${targetProp.floodRisk.distanceToRiskZoneMeters}m de qualquer cota sujeita a alagamento.`;
    } else {
      responseText = `Entendi sua solicitação sobre "${query}". Com base nos dados oficiais e históricos do G2 AUCTION, recomendo analisar os imóveis com liquidez acima de 8.5/10 e débitos judiciais sub-rogados na arrematação. Deseja simular o financiamento ou verificar a diligência jurídica do edital?`;
    }

    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'ai',
      text: responseText,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      provenance,
      actionableProperty: targetProp,
      financialData,
    };

    setMessages((prev) => [...prev, aiMsg]);
    speakText(responseText);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col h-[85vh] overflow-hidden">
        
        {/* Header da Janela de IA */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <Bot className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-base tracking-tight text-white">Copilot de IA - G2 AUCTION</h3>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> pt-BR Nativo
                </span>
              </div>
              <p className="text-xs text-slate-400">"Como posso ajudar seu investimento?"</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sugestões de Prompt Rápido */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center space-x-2 overflow-x-auto text-xs">
          <span className="text-slate-400 font-bold text-[10px] uppercase flex items-center gap-1 flex-shrink-0">
            <Sparkles className="w-3 h-3 text-orange-500" /> Prompts Rápidos:
          </span>
          <button
            onClick={() => handleSend('Encontre imóveis em Campinas com mais de 30% de deságio')}
            className="bg-white text-slate-700 hover:border-orange-500 border border-slate-200 px-2.5 py-1 rounded-full whitespace-nowrap shadow-2xs font-medium"
          >
            Imóveis em Campinas (+30% deságio)
          </button>
          <button
            onClick={() => handleSend('Qual é meu lance máximo para o apartamento do Cambuí?')}
            className="bg-white text-slate-700 hover:border-orange-500 border border-slate-200 px-2.5 py-1 rounded-full whitespace-nowrap shadow-2xs font-medium"
          >
            Calcular Lance Máximo
          </button>
          <button
            onClick={() => handleSend('Registre uma despesa de R$ 2.300 de pedreiro hoje')}
            className="bg-white text-slate-700 hover:border-orange-500 border border-slate-200 px-2.5 py-1 rounded-full whitespace-nowrap shadow-2xs font-medium"
          >
            Registrar Despesa por Voz
          </button>
        </div>

        {/* Chat Stream Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 shadow-2xs relative ${
                  m.sender === 'user'
                    ? 'bg-orange-500 text-white rounded-br-none'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                }`}
              >
                {m.provenance && (
                  <div className="mb-2 flex items-center gap-1.5">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1">
                      <Info className="w-2.5 h-2.5 text-orange-500" /> Proveniência: {m.provenance}
                    </span>
                  </div>
                )}

                <p className="text-sm font-normal leading-relaxed whitespace-pre-line">{m.text}</p>

                {/* Card Ação Direta de Imóvel Recomedado */}
                {m.actionableProperty && (
                  <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-orange-950">{m.actionableProperty.title}</h4>
                      <p className="text-[11px] text-orange-800 font-semibold">
                        Deságio de {m.actionableProperty.apparentDiscountPercentage}% • Mínimo: {formatCurrencyBRL(m.actionableProperty.secondAuctionPrice)}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        onClose();
                        onSelectProperty(m.actionableProperty!);
                      }}
                      className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-2xs"
                    >
                      Ver Ficha 360° <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Detalhes Financeiros Determinísticos */}
                {m.financialData && (
                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 text-xs text-emerald-950">
                    <div className="flex justify-between font-bold">
                      <span>Lance Máximo Sugerido:</span>
                      <span className="text-emerald-700">{formatCurrencyBRL(m.financialData.maxBidPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Desembolso Total Esperado:</span>
                      <span>{formatCurrencyBRL(m.financialData.totalInvestment)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Lucro Líquido Projetado:</span>
                      <span className="font-bold text-emerald-700">{formatCurrencyBRL(m.financialData.expectedNetProfit)}</span>
                    </div>
                  </div>
                )}

                <span
                  className={`text-[10px] block mt-2 text-right ${
                    m.sender === 'user' ? 'text-orange-100' : 'text-slate-400'
                  }`}
                >
                  {m.timestamp}
                </span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input & Botões de Entrada */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2">
          <button
            onClick={toggleListening}
            className={`p-3 rounded-xl transition-all shadow-2xs flex items-center justify-center ${
              isListening
                ? 'bg-red-500 text-white animate-bounce shadow-red-500/40'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            title={isListening ? 'Ouvindo... Clique para parar' : 'Falar por Voz (pt-BR)'}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-orange-600" />}
          </button>

          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder='Pergunte ao G2 (Ex: "Qual o lance máximo para o imóvel em Campinas?")'
            className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-800 placeholder-slate-400 font-medium"
          />

          <button
            onClick={() => handleSend()}
            disabled={!inputQuery.trim()}
            className="bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white p-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
