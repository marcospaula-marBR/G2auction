import React, { useState } from 'react';
import type { LedgerEntry, Property } from '../types/auction';
import { calculateBenchmarkReturns, formatCurrencyBRL } from '../utils/financial';
import { Wallet, Plus, Mic, ShieldCheck, TrendingUp, BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

interface InvestmentLedgerProps {
  property: Property;
  entries: LedgerEntry[];
  onAddEntry: (entry: Omit<LedgerEntry, 'id'>) => void;
  onOpenVoiceModal?: () => void;
}

export const InvestmentLedger: React.FC<InvestmentLedgerProps> = ({
  property,
  entries,
  onAddEntry,
  onOpenVoiceModal,
}) => {
  const [category, setCategory] = useState<LedgerEntry['category']>('Mão de Obra Reforma');
  const [amount, setAmount] = useState<number>(0);
  const [supplier, setSupplier] = useState('');
  const [description, setDescription] = useState('');

  const propertyEntries = entries.filter((e) => e.propertyId === property.id);
  const totalExpenses = propertyEntries.reduce((acc, curr) => acc + curr.amount, 0);
  const initialInvested = property.secondAuctionPrice + (property.secondAuctionPrice * 0.09); // Lance + leiloeiro/cartório

  // Benchmark financeiro tradicional
  const benchmarks = calculateBenchmarkReturns(initialInvested, 10);
  
  // Lucro imobiliário projetado vs renda fixa
  const expectedPropertyProfit = property.estimatedMarketPrice * 0.95 - (initialInvested + property.renovationEstimate);
  const propertyRoi = (expectedPropertyProfit / (initialInvested + property.renovationEstimate)) * 100;

  const benchmarkChartData = [
    { name: 'Poupança', ret: benchmarks[0].roiPercent, fill: '#94a3b8' },
    { name: 'CDB 100% CDI', ret: benchmarks[1].roiPercent, fill: '#64748b' },
    { name: 'IPCA + 6%', ret: benchmarks[2].roiPercent, fill: '#334155' },
    { name: 'Ibovespa', ret: benchmarks[3].roiPercent, fill: '#f59e0b' },
    { name: 'Imóvel G2 (Base)', ret: Number(propertyRoi.toFixed(1)), fill: '#f97316' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0 || !description) return;

    onAddEntry({
      propertyId: property.id,
      category,
      amount,
      date: new Date().toISOString().split('T')[0],
      supplier: supplier || 'Fornecedor Direto',
      description,
      provenance: 'MANUAL',
    });

    setAmount(0);
    setSupplier('');
    setDescription('');
  };

  return (
    <div className="space-y-6">
      
      {/* Cards de Métricas do Livro Caixa */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Lançado (Livro Caixa)</span>
            <span className="text-2xl font-black text-slate-900">{formatCurrencyBRL(totalExpenses)}</span>
            <span className="text-xs text-slate-500 font-medium block mt-0.5">{propertyEntries.length} lançamentos auditados</span>
          </div>
          <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 border border-orange-200">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Estimativa Reforma Inicial</span>
            <span className="text-2xl font-black text-slate-800">{formatCurrencyBRL(property.renovationEstimate)}</span>
            <span className={`text-xs font-bold block mt-0.5 ${totalExpenses > property.renovationEstimate ? 'text-red-600' : 'text-emerald-600'}`}>
              {totalExpenses > property.renovationEstimate ? 'Atenção: Orçamento Excedido' : 'Dentro do Orçamento'}
            </span>
          </div>
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 border border-emerald-200">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">ROI Imobiliário vs CDB</span>
            <span className="text-2xl font-black text-emerald-600">+{propertyRoi.toFixed(1)}%</span>
            <span className="text-xs text-slate-500 block mt-0.5">Supera CDB em +{(propertyRoi - benchmarks[1].roiPercent).toFixed(1)}%</span>
          </div>
          <div className="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-600 border border-sky-200">
            <BarChart2 className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Formulário de Novo Lançamento e Ativador por Voz */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Plus className="w-5 h-5 text-orange-600" />
            <h3 className="font-extrabold text-sm text-slate-900">Novo Lançamento no Livro Caixa</h3>
          </div>

          <button
            onClick={onOpenVoiceModal}
            className="bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-orange-200 flex items-center gap-1.5 transition-all shadow-2xs"
          >
            <Mic className="w-4 h-4 text-orange-600 animate-pulse" />
            <span>Lançar por Voz (pt-BR)</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          
          <div>
            <label className="font-bold text-slate-600 block mb-1">Categoria:</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800"
            >
              <option value="Mão de Obra Reforma">Mão de Obra Reforma</option>
              <option value="Materiais Reforma">Materiais Reforma</option>
              <option value="Honorários Advocatícios">Honorários Advocatícios</option>
              <option value="Escritura & Cartório">Escritura & Cartório</option>
              <option value="ITBI">ITBI</option>
              <option value="Desocupação">Desocupação</option>
              <option value="IPTU / Condomínio">IPTU / Condomínio</option>
              <option value="Outros">Outros</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-600 block mb-1">Valor (R$):</label>
            <input
              type="number"
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="Ex: 2300"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800"
            />
          </div>

          <div>
            <label className="font-bold text-slate-600 block mb-1">Fornecedor / Favorecido:</label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Ex: Pedreiro Silva"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800"
            />
          </div>

          <div>
            <label className="font-bold text-slate-600 block mb-1">Descrição:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Pagamento 1ª etapa reforma"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800"
              />
              <button
                type="submit"
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex-shrink-0"
              >
                Registrar
              </button>
            </div>
          </div>

        </form>
      </div>

      {/* Tabela do Livro Caixa */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-700">
          <span>Histórico do Livro Caixa Auditado</span>
          <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" /> Registro Imutável
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/60 text-slate-500 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Fornecedor</th>
                <th className="py-3 px-4">Descrição</th>
                <th className="py-3 px-4">Origem</th>
                <th className="py-3 px-4 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {propertyEntries.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50 font-medium">
                  <td className="py-3 px-4 font-bold text-slate-900">{e.date}</td>
                  <td className="py-3 px-4 font-bold text-orange-600">{e.category}</td>
                  <td className="py-3 px-4">{e.supplier}</td>
                  <td className="py-3 px-4">{e.description}</td>
                  <td className="py-3 px-4">
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      e.provenance === 'VOICE_REGISTERED' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {e.provenance === 'VOICE_REGISTERED' ? '🎤 VOZ' : 'MANUAL'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-black text-slate-900">{formatCurrencyBRL(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Benchmark Financeiro Comparativo */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div>
          <h3 className="font-black text-slate-900 text-base">Benchmark de Rendimento vs Mercado Tradicional</h3>
          <p className="text-xs text-slate-500">Comparativo do ROI líquido do investimento imobiliário com aplicações de renda fixa e variável no mesmo período.</p>
        </div>

        <div className="h-64 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={benchmarkChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 'bold' }} stroke="#64748b" />
              <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} stroke="#64748b" />
              <Tooltip formatter={(value: any) => [`${value}% ROI`, 'Retorno Estimado']} />
              <Bar dataKey="ret" radius={[8, 8, 0, 0]}>
                {benchmarkChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};
