import React from 'react';
import type { Property, UserProfile } from '../types/auction';
import { formatCurrencyBRL } from '../utils/financial';
import { Brain, ArrowUpRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface PortfolioDashboardProps {
  userProfile: UserProfile;
  properties: Property[];
  onSelectProperty: (property: Property) => void;
}

export const PortfolioDashboard: React.FC<PortfolioDashboardProps> = ({
  userProfile,
  properties,
}) => {
  const chartData = [
    { month: 'Jan', patrimônio: 450000, retorno: 12 },
    { month: 'Mar', patrimônio: 680000, retorno: 18 },
    { month: 'Mai', patrimônio: 920000, retorno: 24 },
    { month: 'Jul', patrimônio: 1240000, retorno: 34 },
  ];

  return (
    <div className="space-y-6">
      
      {/* Cards Principais do Portfólio */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Patrimônio em Ativos</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-black text-slate-900">{formatCurrencyBRL(userProfile.allocatedCapital)}</span>
          </div>
          <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 mt-1">
            <ArrowUpRight className="w-3.5 h-3.5" /> +28% nos últimos 12m
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Retorno Anualizado (TIR)</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-black text-emerald-600">+{userProfile.targetIrr}% a.a.</span>
          </div>
          <span className="text-xs text-slate-500 font-medium block mt-1">
            Alvo de Carteira: {userProfile.targetRoi}% ROI
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Imóveis em Carteira</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-black text-slate-900">{properties.length} Ativos</span>
          </div>
          <span className="text-xs text-slate-500 font-medium block mt-1">
            2 em Reforma • 1 em Hab.
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Lucro Projetado Total</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-black text-orange-600">{formatCurrencyBRL(345000)}</span>
          </div>
          <span className="text-xs text-slate-500 font-medium block mt-1">
            Exit médio em 9,5 meses
          </span>
        </div>

      </div>

      {/* Gráfico de Evolução Patrimonial */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-slate-900 text-base">Evolução do Capital e Rentabilidade Real</h3>
            <p className="text-xs text-slate-500">Curva de crescimento acumulado da carteira G2 AUCTION.</p>
          </div>
          <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200">
            Outperformance vs CDI: +23.7%
          </span>
        </div>

        <div className="h-64 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPatrimonio" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 'bold' }} stroke="#64748b" />
              <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="#64748b" />
              <Tooltip formatter={(v: any) => [formatCurrencyBRL(v), 'Patrimônio']} />
              <Area type="monotone" dataKey="patrimônio" stroke="#ea580c" strokeWidth={3} fillOpacity={1} fill="url(#colorPatrimonio)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Aprendizado do Modelo e Inteligência Histórica */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-xl space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <Brain className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-white">Aprendizado Continuo da IA de Investimento</h3>
            <p className="text-xs text-slate-300">Insights extraídos da comparação do Previsto vs Realizado em seus últimos leilões.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
          
          <div className="bg-white/10 p-4 rounded-2xl border border-white/10 space-y-1">
            <span className="text-orange-400 font-bold block">Bairro Mais Lucrativo:</span>
            <p className="font-extrabold text-sm text-white">Cambuí (Campinas/SP)</p>
            <p className="text-[11px] text-slate-300">Margem média apurada foi +8.4% acima da estimativa inicial do modelo.</p>
          </div>

          <div className="bg-white/10 p-4 rounded-2xl border border-white/10 space-y-1">
            <span className="text-emerald-400 font-bold block">Desempenho de Parceiro:</span>
            <p className="font-extrabold text-sm text-white">Dra. Gabriela Vasconcelos</p>
            <p className="text-[11px] text-slate-300">Tempo médio de imissão na posse foi de apenas 42 dias (50% mais rápido que a média do TJ-SP).</p>
          </div>

          <div className="bg-white/10 p-4 rounded-2xl border border-white/10 space-y-1">
            <span className="text-amber-400 font-bold block">Ajuste de Custo de Reforma:</span>
            <p className="font-extrabold text-sm text-white">+ 6,2% em Elétrica</p>
            <p className="text-[11px] text-slate-300">O modelo ajustou a margem de segurança de instalações elétricas para futuros arremates.</p>
          </div>

        </div>
      </div>

    </div>
  );
};
