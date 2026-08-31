import React, { useState } from 'react';
import type { Property } from '../types/auction';
import { Calculator, X, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrencyBRL } from '../utils/financial';

interface MatrizDespesasProps {
  property: Property;
  onClose: () => void;
}


const pctOf = (base: number, pct: number) => Math.round(base * pct / 100);

export const MatrizDespesas: React.FC<MatrizDespesasProps> = ({ property, onClose }) => {
  const basePrice = property.secondAuctionPrice || property.firstAuctionPrice;
  const appraisal = property.appraisalValue;

  // ── AQUISIÇÃO ──────────────────────────────────────────────
  const [lance, setLance] = useState(basePrice);
  const [comissaoLeiloeiro, setComissaoLeiloeiro] = useState(pctOf(basePrice, 5));
  const [caucao, setCaucao] = useState(0);
  const [taxaPlataforma, setTaxaPlataforma] = useState(0);
  const [custasJudiciais, setCustasJudiciais] = useState(0);

  // ── CARTÓRIO E TRIBUTOS ────────────────────────────────────
  const [itbi, setItbi] = useState(pctOf(basePrice, 3));
  const [escritura, setEscritura] = useState(pctOf(basePrice, 1));
  const [registroAverbacoes, setRegistroAverbacoes] = useState(pctOf(basePrice, 0.5));
  const [certidoes, setCertidoes] = useState(500);
  const [laudemio, setLaudemio] = useState(0);

  // ── PASSIVOS DO IMÓVEL ──────────────────────────────────────
  const [iptuDebito, setIptuDebito] = useState(property.debts.iptu);
  const [condominioDebito, setCondominioDebito] = useState(property.debts.condominium);
  const [aguaLuzGas, setAguaLuzGas] = useState(500);
  const [desocupacao, setDesocupacao] = useState(0);
  const [honorariosCobranca, setHonorariosCobranca] = useState(0);

  // ── SAÍDA / REVENDA ────────────────────────────────────────
  const [reforma, setReforma] = useState(property.renovationEstimate);
  const [fotosAnuncios, setFotosAnuncios] = useState(1500);
  const [corretagem, setCorretagem] = useState(pctOf(appraisal, 6));
  const [irGcap, setIrGcap] = useState(0);
  const [contabilidade, setContabilidade] = useState(800);

  // ── PARÂMETROS DE SAÍDA ────────────────────────────────────
  const [precoVendaAlvo, setPrecoVendaAlvo] = useState(appraisal);
  const [margemMinimaPercent, setMargemMinimaPercent] = useState(20);

  // ── CÁLCULOS ───────────────────────────────────────────────
  const [showAquisicao, setShowAquisicao] = useState(true);
  const [showCartorio, setShowCartorio] = useState(true);
  const [showPassivos, setShowPassivos] = useState(true);
  const [showSaida, setShowSaida] = useState(true);

  const totalAquisicao = lance + comissaoLeiloeiro + caucao + taxaPlataforma + custasJudiciais;
  const totalCartorio = itbi + escritura + registroAverbacoes + certidoes + laudemio;
  const totalPassivos = iptuDebito + condominioDebito + aguaLuzGas + desocupacao + honorariosCobranca;
  const totalSaida = reforma + fotosAnuncios + corretagem + irGcap + contabilidade;
  const totalGeral = totalAquisicao + totalCartorio + totalPassivos + totalSaida;
  const lucroLiquido = precoVendaAlvo - totalGeral;
  const roiPercent = precoVendaAlvo > 0 ? ((lucroLiquido / totalGeral) * 100) : 0;

  const margemMinimaReais = precoVendaAlvo * (margemMinimaPercent / 100);
  const precoTeto = precoVendaAlvo - (totalGeral - lance) - margemMinimaReais;
  const descontoSobreAvaliacao = appraisal > 0 ? ((appraisal - lance) / appraisal * 100) : 0;

  const isViavel = lucroLiquido >= margemMinimaReais;

  const numInput = (value: number, setter: (v: number) => void, label: string) => (
    <div className="flex items-center justify-between gap-2">
      <label className="text-xs text-slate-600 flex-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => setter(Number(e.target.value))}
        className="w-32 text-right bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-300"
      />
    </div>
  );

  const sectionHeader = (title: string, total: number, open: boolean, toggle: () => void, accent: string) => (
    <button
      onClick={toggle}
      className={`w-full flex items-center justify-between p-3 rounded-xl border ${accent} font-black text-xs text-left transition-all hover:opacity-90`}
    >
      <span>{title}</span>
      <div className="flex items-center gap-2">
        <span className="font-black">{formatCurrencyBRL(total)}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 opacity-60" /> : <ChevronDown className="w-3.5 h-3.5 opacity-60" />}
      </div>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-black text-base">Matriz de Despesas Completa</h3>
              <p className="text-xs text-slate-300 truncate max-w-sm">{property.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Preço de Venda Alvo */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-black text-blue-700 uppercase tracking-wider">🏁 Parâmetros de Saída</p>
            {numInput(precoVendaAlvo, setPrecoVendaAlvo, 'Preço de Venda Alvo (R$)')}
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-slate-600 flex-1">Margem Mínima Desejada (%)</label>
              <div className="flex items-center gap-2">
                <input
                  type="range" min={5} max={50} step={1} value={margemMinimaPercent}
                  onChange={e => setMargemMinimaPercent(Number(e.target.value))}
                  className="w-20 accent-blue-500"
                />
                <span className="text-xs font-black text-blue-700 w-12 text-right">{margemMinimaPercent}%</span>
              </div>
            </div>
          </div>

          {/* AQUISIÇÃO */}
          <div className="space-y-2">
            {sectionHeader('📦 Aquisição', totalAquisicao, showAquisicao, () => setShowAquisicao(p => !p), 'bg-orange-50 border-orange-200 text-orange-800')}
            {showAquisicao && (
              <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-3 space-y-2">
                {numInput(lance, setLance, 'Lance / Preço de Arrematação')}
                {numInput(comissaoLeiloeiro, setComissaoLeiloeiro, 'Comissão do Leiloeiro (5% edital)')}
                {numInput(caucao, setCaucao, 'Caução / Sinal / Depósito')}
                {numInput(taxaPlataforma, setTaxaPlataforma, 'Taxa de Plataforma')}
                {numInput(custasJudiciais, setCustasJudiciais, 'Custas Judiciais ou Administrativas')}
              </div>
            )}
          </div>

          {/* CARTÓRIO */}
          <div className="space-y-2">
            {sectionHeader('🏛️ Cartório e Tributos', totalCartorio, showCartorio, () => setShowCartorio(p => !p), 'bg-purple-50 border-purple-200 text-purple-800')}
            {showCartorio && (
              <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-3 space-y-2">
                {numInput(itbi, setItbi, 'ITBI Municipal (~3% do lance)')}
                {numInput(escritura, setEscritura, 'Escritura / Carta / Contrato (~1%)')}
                {numInput(registroAverbacoes, setRegistroAverbacoes, 'Registro e Averbações (~0,5%)')}
                {numInput(certidoes, setCertidoes, 'Certidões e Matrícula Atualizada')}
                {numInput(laudemio, setLaudemio, 'Laudêmio/Foro (se aplicável)')}
              </div>
            )}
          </div>

          {/* PASSIVOS */}
          <div className="space-y-2">
            {sectionHeader('⚠️ Passivos do Imóvel', totalPassivos, showPassivos, () => setShowPassivos(p => !p), 'bg-red-50 border-red-200 text-red-800')}
            {showPassivos && (
              <div className="bg-red-50/50 border border-red-100 rounded-xl p-3 space-y-2">
                {numInput(iptuDebito, setIptuDebito, 'IPTU, Taxas e Dívida Ativa')}
                {numInput(condominioDebito, setCondominioDebito, 'Condomínio, Multa e Juros')}
                {numInput(aguaLuzGas, setAguaLuzGas, 'Água, Luz, Gás e Religação')}
                {numInput(desocupacao, setDesocupacao, 'Desocupação / Imissão na Posse')}
                {numInput(honorariosCobranca, setHonorariosCobranca, 'Honorários e Custas de Cobrança')}
              </div>
            )}
          </div>

          {/* SAÍDA */}
          <div className="space-y-2">
            {sectionHeader('📣 Saída / Revenda', totalSaida, showSaida, () => setShowSaida(p => !p), 'bg-amber-50 border-amber-200 text-amber-800')}
            {showSaida && (
              <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 space-y-2">
                {numInput(reforma, setReforma, 'Limpeza, Reforma e Laudos')}
                {numInput(fotosAnuncios, setFotosAnuncios, 'Fotos, Anúncios e Portais')}
                {numInput(corretagem, setCorretagem, 'Corretagem (~6% sobre venda)')}
                {numInput(irGcap, setIrGcap, 'IR Ganho de Capital (GCAP)')}
                {numInput(contabilidade, setContabilidade, 'Contabilidade e Dossiê Final')}
              </div>
            )}
          </div>

          {/* Resultado */}
          <div className={`rounded-3xl p-5 border ${isViavel ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-red-500 to-rose-600'} text-white space-y-4`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider opacity-80">Resultado da Operação</span>
              <Sparkles className="w-4 h-4 opacity-80" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] opacity-70 uppercase font-bold">Desembolso Total</p>
                <p className="text-xl font-black">{formatCurrencyBRL(totalGeral)}</p>
              </div>
              <div>
                <p className="text-[10px] opacity-70 uppercase font-bold">Lucro Líquido</p>
                <p className={`text-xl font-black ${lucroLiquido >= 0 ? 'text-white' : 'text-red-200'}`}>
                  {formatCurrencyBRL(lucroLiquido)}
                </p>
              </div>
            </div>

            <div className="bg-black/20 rounded-2xl p-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] opacity-70 font-bold">ROI Bruto</p>
                <p className="text-base font-black">{roiPercent.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-[10px] opacity-70 font-bold">Desc. s/ Avaliação</p>
                <p className="text-base font-black">{descontoSobreAvaliacao.toFixed(1)}%</p>
              </div>
            </div>

            <div className="bg-black/30 rounded-2xl p-3">
              <p className="text-[10px] opacity-70 uppercase font-bold mb-1">🎯 Preço-Teto Calculado</p>
              <p className="text-2xl font-black">{formatCurrencyBRL(Math.max(0, precoTeto))}</p>
              <p className="text-[10px] opacity-70 mt-1">
                Lance máximo seguro com margem de {margemMinimaPercent}% preservada
              </p>
            </div>

            <div className={`text-xs font-black text-center py-2 px-4 rounded-xl ${
              isViavel ? 'bg-white/20' : 'bg-black/30'
            }`}>
              {isViavel ? '✅ OPERAÇÃO VIÁVEL' : '⛔ OPERAÇÃO ABAIXO DA MARGEM MÍNIMA'}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50 flex-shrink-0">
          <p className="text-[10px] text-slate-500 font-medium max-w-xs">
            Os valores são estimativas. Confirme débitos reais com a prefeitura e administradora antes do lance.
          </p>
          <button
            onClick={onClose}
            className="bg-slate-900 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-colors"
          >
            Fechar Matriz
          </button>
        </div>

      </div>
    </div>
  );
};
