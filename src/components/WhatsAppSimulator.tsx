import React, { useState } from 'react';
import type { Property } from '../types/auction';
import { X, Send, ShieldCheck, CheckCheck } from 'lucide-react';

interface WhatsAppSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  onSelectProperty: (property: Property) => void;
}

export const WhatsAppSimulator: React.FC<WhatsAppSimulatorProps> = ({
  isOpen,
  onClose,
}) => {
  const [messages, setMessages] = useState<any[]>([
    {
      id: 1,
      sender: 'bot',
      text: '🤖 *G2 AUCTION WhatsApp Notifier*\n\nOlá, Investidor! Detectamos uma nova oportunidade de leilão judicial em *Campinas (Cambuí)* com deságio de *38%*.\n\n*Imóvel:* Apto 98m² Maria Monteiro\n*Mínimo 2ª Praça:* R$ 446.400\n*Avaliação:* R$ 720.000\n\nDeseja receber o Laudo de Inteligência ou calcular seu Lance Máximo?',
      time: '14:32',
    },
  ]);
  const [inputText, setInputText] = useState('');

  const handleSend = (override?: string) => {
    const txt = (override || inputText).trim();
    if (!txt) return;

    const userMsg = { id: Date.now(), sender: 'user', text: txt, time: 'Agora' };
    setMessages((prev) => [...prev, userMsg]);
    if (!override) setInputText('');

    setTimeout(() => {
      let botText = '';
      if (txt.toLowerCase().includes('laudo') || txt.toLowerCase().includes('inteligência') || txt.toLowerCase().includes('edital')) {
        botText = '📄 *Laudo de Inteligência Imobiliária G2 Gerado*\n\n✅ *Edital Verificado:* 100% autêntico no site da Mega Leilões.\n✅ *Diligência Jurídica:* Condomínio e IPTU sub-rogados pela Caixa.\n✅ *Lance Máximo Racional:* R$ 485.000\n\nClique no link abaixo para abrir a Ficha 360° no App:';
      } else if (txt.toLowerCase().includes('aprovar') || txt.toLowerCase().includes('lance')) {
        botText = '🚀 *Ordem de Habilitação Enviada!*\n\nSua proposta de arrematação até R$ 485.000 foi registrada e encaminhada para validação pela Dra. Gabriela Vasconcelos. Avisaremos assim que a praça abrir!';
      } else {
        botText = '👍 Entendido! O assistente G2 AUCTION sincronizou sua solicitação no painel web. Você também pode enviar fotos e recibos por este WhatsApp para lançamento automático no Livro Caixa!';
      }

      setMessages((prev) => [...prev, { id: Date.now() + 1, sender: 'bot', text: botText, time: 'Agora' }]);
    }, 700);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-300">
      
      {/* Header WhatsApp Verde Oficial */}
      <div className="bg-[#075E54] text-white p-4 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center font-black text-lg text-emerald-100 border border-emerald-500">
            G2
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h3 className="font-bold text-sm">G2 AUCTION - Notifier</h3>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-[11px] text-emerald-200">Conta Comercial Verificada • Online</p>
          </div>
        </div>

        <button onClick={onClose} className="text-emerald-200 hover:text-white p-2 rounded-lg">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Papel de Parede do WhatsApp */}
      <div className="flex-1 bg-[#E5DDD5] p-4 overflow-y-auto space-y-3 font-sans">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[85%] p-3 rounded-2xl shadow-xs text-xs whitespace-pre-line leading-relaxed ${
                m.sender === 'user' ? 'bg-[#DCF8C6] text-slate-900 rounded-tr-none' : 'bg-white text-slate-900 rounded-tl-none'
              }`}
            >
              {m.text}
              <div className="flex items-center justify-end space-x-1 mt-1 text-[9px] text-slate-400">
                <span>{m.time}</span>
                {m.sender === 'user' && <CheckCheck className="w-3 h-3 text-sky-600" />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Botões de Ação Rápida WhatsApp */}
      <div className="bg-[#F0F0F0] border-t border-slate-300 p-2 flex gap-1 overflow-x-auto text-[11px]">
        <button
          onClick={() => handleSend('Enviar Laudo de Inteligência do imóvel')}
          className="bg-white border border-slate-300 text-slate-700 font-bold px-2.5 py-1 rounded-full whitespace-nowrap shadow-2xs hover:bg-emerald-50"
        >
          📄 Receber Laudo PDF
        </button>
        <button
          onClick={() => handleSend('Aprovar proposta de lance de R$ 485.000')}
          className="bg-white border border-slate-300 text-slate-700 font-bold px-2.5 py-1 rounded-full whitespace-nowrap shadow-2xs hover:bg-emerald-50"
        >
          ✅ Aprovar Lance
        </button>
      </div>

      {/* Input WhatsApp */}
      <div className="bg-[#F0F0F0] p-3 flex items-center space-x-2 border-t border-slate-300">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Mensagem para G2 AUCTION..."
          className="flex-1 bg-white border border-slate-300 rounded-full px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#075E54]"
        />
        <button
          onClick={() => handleSend()}
          className="bg-[#075E54] hover:bg-[#128C7E] text-white p-2.5 rounded-full shadow-md transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
