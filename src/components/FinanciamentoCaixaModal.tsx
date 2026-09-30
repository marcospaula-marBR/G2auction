import { useState, useMemo } from 'react';
import {
  X,
  Home,
  TrendingDown,
  DollarSign,
  Calendar,
  Info,
  CheckCircle,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { PropertyHeaderSummary, getBankBadgeConfig } from './PropertyHeaderSummary';

interface FinanciamentoCaixaModalProps {
  property: any;
  onClose: () => void;
}

// Taxas e parâmetros referenciais por Banco
const BANK_RATES = {
  CAIXA: {
    name: 'CAIXA Habitação',
    rateSFH: 0.0695, // 6.95% a.a.
    rateSFI: 0.1199, // 11.99% a.a.
    maxYears: 35,
    minDownPct: 20,
    minDownPctAuction: 5,
    supportsFGTS: true,
    minPropertyValue: 0,
    note: 'Condições oficiais CAIXA Habitação (SFH Poupança / SFI)',
  },
  SANTANDER: {
    name: 'Santander Crédito Imobiliário',
    rateSFH: 0.1049, // 10.49% a.a.
    rateSFI: 0.1149, // 11.49% a.a.
    maxYears: 35,
    minDownPct: 20,
    minDownPctAuction: 20,
    supportsFGTS: false,
    minPropertyValue: 90000,
    note: 'O Banco Santander exige valor de venda mínimo de R$ 90.000 para financiamento.',
  },
  BRADESCO: {
    name: 'Bradesco Crédito Imobiliário',
    rateSFH: 0.1050, // 10.50% a.a.
    rateSFI: 0.1150, // 11.50% a.a.
    maxYears: 30,
    minDownPct: 20,
    minDownPctAuction: 20,
    supportsFGTS: false,
    minPropertyValue: 0,
    note: 'Bradesco Crédito Imobiliário com até 360 meses e taxa balcão.',
  },
  BB: {
    name: 'Banco do Brasil (Seu Imóvel BB)',
    rateSFH: 0.1020, // 10.20% a.a.
    rateSFI: 0.1120, // 11.20% a.a.
    maxYears: 35,
    minDownPct: 20,
    minDownPctAuction: 20,
    supportsFGTS: true,
    minPropertyValue: 0,
    note: 'Financiamento Imobiliário BB para imóveis retomados em até 420 meses.',
  },
  GERAL: {
    name: 'Calculadora Geral de Mercado',
    rateSFH: 0.1050, // 10.50% a.a.
    rateSFI: 0.1150, // 11.50% a.a.
    maxYears: 30,
    minDownPct: 20,
    minDownPctAuction: 20,
    supportsFGTS: false,
    minPropertyValue: 0,
    note: 'Simulação de referência de mercado. Valores a serem validados no banco selecionado.',
  },
};

const LIMITE_SFH = 1_500_000;
type Sistema = 'SAC' | 'PRICE';

function calcularFinanciamento(
  valorImovel: number,
  entradaVal: number,
  prazoMeses: number,
  taxaAnual: number,
  sistema: Sistema
) {
  const saldo = valorImovel - entradaVal;
  if (saldo <= 0 || prazoMeses <= 0) return null;

  const taxaMensal = Math.pow(1 + taxaAnual, 1 / 12) - 1;

  if (sistema === 'PRICE') {
    const coef = (taxaMensal * Math.pow(1 + taxaMensal, prazoMeses)) /
                 (Math.pow(1 + taxaMensal, prazoMeses) - 1);
    const parcela   = saldo * coef;
    const totalPago = parcela * prazoMeses;
    return { parcela1: parcela, parcelaUltima: parcela, totalPago, totalJuros: totalPago - saldo, saldoFinanciado: saldo };
  }

  // SAC
  const amortizacao   = saldo / prazoMeses;
  const jurosMes1     = saldo * taxaMensal;
  const parcela1      = amortizacao + jurosMes1;
  const jurosMesN     = amortizacao * taxaMensal;
  const parcelaUltima = amortizacao + jurosMesN;
  const totalJuros    = ((jurosMes1 + jurosMesN) / 2) * prazoMeses;
  const totalPago     = saldo + totalJuros;
  return { parcela1, parcelaUltima, totalPago, totalJuros, saldoFinanciado: saldo };
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function fmtNumber(v: number): string {
  return Math.round(v).toLocaleString('pt-BR');
}

function fmtPctNumber(v: number): string {
  if (Math.abs(v - Math.round(v)) < 0.05) {
    return String(Math.round(v));
  }
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function parseCurrencyInput(raw: string): number {
  if (!raw) return NaN;
  let s = raw.trim().toLowerCase().replace(/^r\$\s*/, '').trim();
  let multiplier = 1;

  if (s.endsWith('k')) {
    multiplier = 1000;
    s = s.slice(0, -1).trim();
  } else if (s.includes('mil')) {
    multiplier = 1000;
    s = s.replace('mil', '').trim();
  }

  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  } else if (s.includes('.')) {
    const parts = s.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      s = s.replace(/\./g, '');
    }
  }

  const clean = s.replace(/[^\d.]/g, '');
  const val = parseFloat(clean);
  return isNaN(val) ? NaN : val * multiplier;
}

function parsePctInput(raw: string): number {
  if (!raw) return NaN;
  const s = raw.trim().replace('%', '').replace(',', '.').replace(/[^\d.]/g, '');
  const val = parseFloat(s);
  return isNaN(val) ? NaN : val;
}

// ── Modal principal ────────────────────────────────────────────────────────────
export function FinanciamentoCaixaModal({ property, onClose }: FinanciamentoCaixaModalProps) {
  const valorImovel = Number(
    property?.secondAuctionPrice ||
    property?.current_minimum_value ||
    property?.sale_value ||
    property?.preco_minimo ||
    property?.price ||
    300_000
  );

  const avaliacaoImovel = Number(
    property?.appraisalValue ||
    property?.evaluation_value ||
    property?.preco_avaliacao ||
    valorImovel * 1.5
  );

  // Identificação do Banco Nativo do Imóvel
  const bankConfig = getBankBadgeConfig(property);
  const detectedBankKey = useMemo<'CAIXA' | 'SANTANDER' | 'BRADESCO' | 'BB' | 'GERAL'>(() => {
    const sn = bankConfig.shortName.toUpperCase();
    if (sn.includes('SANTANDER')) return 'SANTANDER';
    if (sn.includes('BRADESCO')) return 'BRADESCO';
    if (sn.includes('BRASIL') || sn.includes('BB')) return 'BB';
    if (sn.includes('CAIXA')) return 'CAIXA';
    return 'GERAL';
  }, [bankConfig.shortName]);

  const [selectedBankKey, setSelectedBankKey] = useState<'CAIXA' | 'SANTANDER' | 'BRADESCO' | 'BB' | 'GERAL'>(detectedBankKey);

  const currentBankRules = BANK_RATES[selectedBankKey];

  // Regra de R$ 90.000 do Santander
  const isSantanderBelowMin = selectedBankKey === 'SANTANDER' && valorImovel < 90000;

  // Se o imóvel aceita financiamento do lance na Caixa
  const aceitaFinanciamentoCaixa = (selectedBankKey === 'CAIXA') && (property?.isFinancable ?? property?.accepts_financing ?? false);
  const isSFH = avaliacaoImovel <= LIMITE_SFH;

  const entradaPctMin = aceitaFinanciamentoCaixa
    ? currentBankRules.minDownPctAuction
    : (isSFH ? currentBankRules.minDownPct : 30);
  const prazoMax = currentBankRules.maxYears;

  // Estado da Entrada: o valor em R$ é a fonte de verdade para evitar arredondamento forçado
  const entradaMinReais = Math.round(valorImovel * (entradaPctMin / 100));
  const [entradaVal, setEntradaVal] = useState<number>(() => entradaMinReais);

  // Estados locais para digitação livre e sem travamento nos inputs de Entrada
  const [reaisStr, setReaisStr]         = useState('');
  const [reaisFocused, setReaisFocused] = useState(false);
  const [pctStr, setPctStr]             = useState('');
  const [pctFocused, setPctFocused]     = useState(false);

  // Estados de Prazo
  const [prazoAnos, setPrazoAnos]         = useState(Math.min(30, prazoMax));
  const [anosStr, setAnosStr]             = useState('');
  const [anosFocused, setAnosFocused]     = useState(false);
  const [mesesStr, setMesesStr]           = useState('');
  const [mesesFocused, setMesesFocused]   = useState(false);

  // Outros estados
  const [sistema, setSistema]   = useState<Sistema>('SAC');
  const [useFGTS, setUseFGTS]   = useState(false);
  const [fgtsVal, setFgtsVal]   = useState(50_000);
  const [fgtsStr, setFgtsStr]   = useState('');
  const [fgtsFocused, setFgtsFocused] = useState(false);

  const taxaAnual = avaliacaoImovel > LIMITE_SFH ? currentBankRules.rateSFI : currentBankRules.rateSFH;
  const prazoMeses = Math.min(prazoAnos * 12, prazoMax * 12);

  // Percentual exato derivado do valor da entrada
  const entradaPct = valorImovel > 0 ? (entradaVal / valorImovel) * 100 : entradaPctMin;
  const entradaOk  = entradaVal >= entradaMinReais - 1;

  const fgtsAplicado   = useFGTS && currentBankRules.supportsFGTS && isSFH ? Math.min(fgtsVal, entradaVal * 0.8) : 0;
  const entradaEfetiva = Math.max(entradaVal - fgtsAplicado, 0);

  const resultado = useMemo(
    () => calcularFinanciamento(valorImovel, entradaVal, prazoMeses, taxaAnual, sistema),
    [valorImovel, entradaVal, prazoMeses, taxaAnual, sistema]
  );

  // Commit da entrada em R$
  const commitReais = () => {
    setReaisFocused(false);
    const parsed = parseCurrencyInput(reaisStr);
    if (!isNaN(parsed) && parsed > 0) {
      setEntradaVal(parsed);
    }
  };

  // Commit da entrada em %
  const commitPct = () => {
    setPctFocused(false);
    const parsed = parsePctInput(pctStr);
    if (!isNaN(parsed) && parsed > 0) {
      const clampedPct = Math.min(80, Math.max(1, parsed));
      setEntradaVal(Math.round(valorImovel * (clampedPct / 100)));
    }
  };

  // Commit de Prazo em Anos
  const commitAnos = () => {
    setAnosFocused(false);
    const a = parseInt(anosStr.replace(/\D/g, ''), 10);
    if (!isNaN(a) && a > 0) {
      setPrazoAnos(Math.min(prazoMax, Math.max(5, a)));
    }
  };

  // Commit de Prazo em Meses
  const commitMeses = () => {
    setMesesFocused(false);
    const m = parseInt(mesesStr.replace(/\D/g, ''), 10);
    if (!isNaN(m) && m > 0) {
      const clampedMeses = Math.min(prazoMax * 12, Math.max(60, m));
      setPrazoAnos(Math.round(clampedMeses / 12));
    }
  };

  // Commit de FGTS
  const commitFgts = () => {
    setFgtsFocused(false);
    const parsed = parseCurrencyInput(fgtsStr);
    if (!isNaN(parsed) && parsed >= 0) {
      setFgtsVal(Math.min(200_000, parsed));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-2xl max-h-[94vh] overflow-y-auto bg-white rounded-3xl shadow-2xl flex flex-col">

        {/* ── Header com Informações Oficiais do Banco e Resumo do Imóvel ───────────────── */}
        <div className="sticky top-0 z-20 px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white rounded-t-3xl flex items-start justify-between border-b border-slate-800">
          <div className="flex-1 pr-4">
            <PropertyHeaderSummary
              property={property}
              contextTitle="Simulador de Financiamento Bancário"
              contextBadge={currentBankRules.name}
              showKpis={true}
            />
          </div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-xl transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Seletor de Banco para Simulação ────────────────────────────────────────── */}
        <div className="px-6 pt-4 pb-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-700">Regras e Parâmetros Bancários:</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {(['CAIXA', 'SANTANDER', 'BRADESCO', 'BB', 'GERAL'] as const).map((key) => {
              const isSelected = selectedBankKey === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedBankKey(key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {key === 'CAIXA' && '🏛️ Caixa'}
                  {key === 'SANTANDER' && '🔴 Santander'}
                  {key === 'BRADESCO' && '🟥 Bradesco'}
                  {key === 'BB' && '🟡 Banco do Brasil'}
                  {key === 'GERAL' && '🧮 Geral de Mercado'}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── ALERTA OFICIAL: SANTANDER ABAIXO DE R$ 90 MIL ───────────────────────────── */}
        {isSantanderBelowMin && (
          <div className="mx-6 mt-4 p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start gap-3 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-black text-amber-900 uppercase">
                ⚠️ Regra Oficial Santander: Financiamento Indisponível para Imóveis abaixo de R$ 90.000
              </h4>
              <p className="text-xs text-amber-800 leading-relaxed">
                O Banco Santander exige valor de venda mínimo de <strong>R$ 90.000,00</strong> para concessão de crédito imobiliário. Para este imóvel (ofertado por <strong>{fmt(valorImovel)}</strong>), a arrematação deve ser realizada à vista ou via consórcio / crédito pessoal.
              </p>
              <div className="pt-1 flex items-center gap-2">
                <button
                  onClick={() => setSelectedBankKey('GERAL')}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                >
                  🧮 Simular na Calculadora Geral de Referência
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── BANNER DE AVISO: CALCULADORA GERAL DE MERCADO ────────────────────────────── */}
        {selectedBankKey === 'GERAL' && (
          <div className="mx-6 mt-3 px-4 py-2.5 rounded-xl text-xs font-medium bg-blue-50 text-blue-900 border border-blue-200 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Simulação de Referência de Mercado:</strong> Taxas, prazos e exigências de entrada são estimativas gerais e devem ser validadas diretamente com o banco emissor ou instituição financeira do arrematante.
            </span>
          </div>
        )}

        {/* ── Dados do imóvel ─────────────────────────────────────────────── */}
        <div className="mx-6 mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 min-w-[150px]">
            <Home className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Preço Mínimo</p>
              <p className="text-slate-900 font-black text-sm">{fmt(valorImovel)}</p>
            </div>
          </div>
          <div className="hidden sm:block w-px h-8 bg-slate-200" />
          <div className="flex items-center gap-2 min-w-[150px]">
            <TrendingDown className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide">Avaliação</p>
              <p className="text-emerald-800 font-black text-sm">{fmt(avaliacaoImovel)}</p>
            </div>
          </div>
          <div className="hidden sm:block w-px h-8 bg-slate-200" />
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-orange-600 shrink-0" />
            <div>
              <p className="text-[10px] text-orange-600 font-semibold uppercase tracking-wide">Taxa Referencial</p>
              <p className="text-orange-800 font-black text-sm">{(taxaAnual * 100).toFixed(2)}% a.a.</p>
            </div>
          </div>
        </div>

        {/* Badge: financiamento do lance liberado */}
        {aceitaFinanciamentoCaixa && (
          <div className="mx-6 mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>Financiamento do lance liberado pela CAIXA — entrada mínima especial de <b>5% do valor de arrematação</b></span>
          </div>
        )}

        {/* Badge SFH/SFI & Banco */}
        <div className="mx-6 mt-3">
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold ${isSFH ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
            {isSFH ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>
              {currentBankRules.name} · Taxa {(taxaAnual * 100).toFixed(2)}% a.a. · Prazo até {prazoMax} anos
              {currentBankRules.supportsFGTS && isSFH ? ' · Permite FGTS' : ''}
            </span>
          </div>
        </div>

        {/* ── Controles de Entrada e Prazo ──────────────────────────────────── */}
        <div className="px-6 mt-4 space-y-5">

          {/* ENTRADA */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-blue-600" />
                Valor da Entrada
              </span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${entradaOk ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                {entradaOk ? `Mínimo de ${entradaPctMin}% atendido` : `Abaixo do mínimo (${entradaPctMin}%)`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Valor em Reais (R$):</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">R$</span>
                  <input
                    type="text"
                    value={reaisFocused ? reaisStr : fmtNumber(entradaVal)}
                    onFocus={() => {
                      setReaisFocused(true);
                      setReaisStr(String(entradaVal));
                    }}
                    onChange={(e) => setReaisStr(e.target.value)}
                    onBlur={commitReais}
                    onKeyDown={(e) => e.key === 'Enter' && commitReais()}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Percentual (%):</label>
                <div className="relative">
                  <input
                    type="text"
                    value={pctFocused ? pctStr : fmtPctNumber(entradaPct)}
                    onFocus={() => {
                      setPctFocused(true);
                      setPctStr(fmtPctNumber(entradaPct));
                    }}
                    onChange={(e) => setPctStr(e.target.value)}
                    onBlur={commitPct}
                    onKeyDown={(e) => e.key === 'Enter' && commitPct()}
                    className="w-full pr-8 pl-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                </div>
              </div>
            </div>

            {/* Slider de Entrada */}
            <input
              type="range"
              min={entradaPctMin}
              max={80}
              step={0.5}
              value={Math.min(80, Math.max(entradaPctMin, entradaPct))}
              onChange={(e) => {
                const p = parseFloat(e.target.value);
                setEntradaVal(Math.round(valorImovel * (p / 100)));
              }}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          {/* USO DE FGTS (se suportado pelo banco) */}
          {currentBankRules.supportsFGTS && isSFH && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-emerald-900">
                <input
                  type="checkbox"
                  checked={useFGTS}
                  onChange={(e) => setUseFGTS(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <span>Utilizar saldo do FGTS para abater a entrada</span>
              </label>

              {useFGTS && (
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <div className="relative w-44">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">R$</span>
                    <input
                      type="text"
                      value={fgtsFocused ? fgtsStr : fmtNumber(fgtsVal)}
                      onFocus={() => {
                        setFgtsFocused(true);
                        setFgtsStr(String(fgtsVal));
                      }}
                      onChange={(e) => setFgtsStr(e.target.value)}
                      onBlur={commitFgts}
                      onKeyDown={(e) => e.key === 'Enter' && commitFgts()}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs font-black text-slate-900 focus:outline-none"
                    />
                  </div>
                  <span className="text-[11px] text-emerald-800">
                    FGTS aplicado: <strong>{fmt(fgtsAplicado)}</strong> (Entrada líquida em dinheiro: <strong>{fmt(entradaEfetiva)}</strong>)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* PRAZO */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                Prazo de Amortização
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                Máximo permitido: {prazoMax} anos ({prazoMax * 12} meses)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Anos:</label>
                <input
                  type="text"
                  value={anosFocused ? anosStr : prazoAnos}
                  onFocus={() => {
                    setAnosFocused(true);
                    setAnosStr(String(prazoAnos));
                  }}
                  onChange={(e) => setAnosStr(e.target.value)}
                  onBlur={commitAnos}
                  onKeyDown={(e) => e.key === 'Enter' && commitAnos()}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Meses:</label>
                <input
                  type="text"
                  value={mesesFocused ? mesesStr : prazoMeses}
                  onFocus={() => {
                    setMesesFocused(true);
                    setMesesStr(String(prazoMeses));
                  }}
                  onChange={(e) => setMesesStr(e.target.value)}
                  onBlur={commitMeses}
                  onKeyDown={(e) => e.key === 'Enter' && commitMeses()}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            <input
              type="range"
              min={5}
              max={prazoMax}
              value={prazoAnos}
              onChange={(e) => setPrazoAnos(parseInt(e.target.value, 10))}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          {/* SISTEMA DE AMORTIZAÇÃO (SAC / PRICE) */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700">Tabela de Amortização:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSistema('SAC')}
                className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${
                  sistema === 'SAC'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                SAC (Parcelas Decrescentes)
              </button>
              <button
                onClick={() => setSistema('PRICE')}
                className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${
                  sistema === 'PRICE'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                PRICE (Parcelas Fixas)
              </button>
            </div>
          </div>

        </div>

        {/* ── RESULTADOS DO FINANCIAMENTO ──────────────────────────────────── */}
        {resultado && (
          <div className="m-6 p-5 bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-3xl space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-300">
                Resultado da Simulação · {currentBankRules.name} ({sistema})
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Prazo: {prazoAnos} anos ({prazoMeses} meses)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">1ª Parcela:</span>
                <span className="text-lg sm:text-xl font-black text-emerald-400">
                  {fmt(resultado.parcela1)}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Última Parcela:</span>
                <span className="text-lg sm:text-xl font-black text-white">
                  {fmt(resultado.parcelaUltima)}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Saldo Financiado:</span>
                <span className="text-sm sm:text-base font-black text-slate-200">
                  {fmt(resultado.saldoFinanciado)}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Total de Juros:</span>
                <span className="text-sm sm:text-base font-black text-amber-400">
                  {fmt(resultado.totalJuros)}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
              <span>Valor Total a Pagar ao Longo do Financiamento:</span>
              <span className="font-black text-white">{fmt(resultado.totalPago)}</span>
            </div>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between rounded-b-3xl">
          <p className="text-[11px] text-slate-500">
            {currentBankRules.note}
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl transition-all shadow-sm"
          >
            Fechar Simulador
          </button>
        </div>

      </div>
    </div>
  );
}

// Export alternativo para fins semânticos
export { FinanciamentoCaixaModal as FinanciamentoBancarioModal };
