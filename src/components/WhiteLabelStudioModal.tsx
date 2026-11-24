import React, { useState } from 'react';
import {
  X, Palette, EyeOff, Eye, Copy, Check, Sparkles, Building2,
  Percent, Sliders, RotateCcw, Shield,
} from 'lucide-react';
import { useTenant, type TenantFeatures } from '../config/tenant';

interface WhiteLabelStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLOR_SWATCHES = [
  { label: 'Slate Executivo', primary: '#0f172a', accent: '#2563eb' },
  { label: 'Laranja Leilão', primary: '#ea580c', accent: '#dc2626' },
  { label: 'Esmeralda Imob', primary: '#065f46', accent: '#10b981' },
  { label: 'Azul Corporativo', primary: '#1e3a8a', accent: '#0284c7' },
  { label: 'Índigo SaaS', primary: '#312e81', accent: '#6366f1' },
];

const FEATURE_LABELS: { key: keyof TenantFeatures; label: string; desc: string }[] = [
  { key: 'map', label: 'Mapa Interativo 2D/3D', desc: 'Visualização geográfica integrada ao catálogo' },
  { key: 'journey', label: 'Minha Jornada (Passo a Passo)', desc: 'Esteira completa do arrematante' },
  { key: 'partners', label: 'Marketplace de Parceiros + Split', desc: 'Corretores, advogados, pedreiros e administradores' },
  { key: 'ledger', label: 'Livro Caixa', desc: 'Controle financeiro de arrematação e obra' },
  { key: 'renovation', label: 'Campo & Obra', desc: 'Gestão de reforma para revenda' },
  { key: 'portfolio', label: 'Carteira & Performance', desc: 'Visão consolidada do investidor' },
  { key: 'copilot', label: 'Copilot IA (Voz)', desc: 'Assistente inteligente de análise' },
  { key: 'adminSync', label: 'Painel Admin / Carga dos Bancos', desc: 'Exibe a aba técnica de sincronização e robôs' },
];

export const WhiteLabelStudioModal: React.FC<WhiteLabelStudioModalProps> = ({ isOpen, onClose }) => {
  const { tenant, updateTenant, applyPreset, resetTenant, getShareableWhiteLabelUrl } = useTenant();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyUrl = async () => {
    const url = getShareableWhiteLabelUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copie o link demo White-Label:', url);
    }
  };

  const isWhiteLabelMode = !tenant.showLogo;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center">
              <Palette className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-sky-400 block">
                Multi-Tenant & Comercialização B2B
              </span>
              <h2 className="text-lg font-black text-white">White-Label Studio</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs">
          {/* Quick Mode Switcher */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-sky-600" /> Modo de Apresentação Comercial
                </h3>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Alterne instantaneamente para demonstrações sem logotipo para imobiliárias, escritórios e fundos.
                </p>
              </div>
              <button
                onClick={handleCopyUrl}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Link Copiado!' : 'Copiar Link Demo (?wl=1)'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => applyPreset('whitelabel')}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                  isWhiteLabelMode
                    ? 'border-blue-600 bg-blue-50/70'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 text-xs">Modo White-Label (Sem Logo)</span>
                  <EyeOff className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Visual neutro, sem logotipos de terceiros e sem splash inicial. Ideal para venda B2B.
                </p>
              </button>

              <button
                onClick={() => applyPreset('g2')}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                  !isWhiteLabelMode
                    ? 'border-orange-500 bg-orange-50/60'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 text-xs">Marca Padrão (G2 AUCTION)</span>
                  <Eye className="w-4 h-4 text-orange-600" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Exibe logotipo oficial, paleta laranja e tela de apresentação.
                </p>
              </button>
            </div>
          </div>

          {/* Identidade do Tenant */}
          <div className="space-y-4">
            <h3 className="font-black text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-500" /> Identidade Visual do Licenciado (Tenant)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Nome da Plataforma</label>
                <input
                  type="text"
                  value={tenant.brandName}
                  onChange={(e) => updateTenant({ brandName: e.target.value })}
                  placeholder="Ex: ImobLeilões Pro"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Slogan / Subtítulo</label>
                <input
                  type="text"
                  value={tenant.tagline}
                  onChange={(e) => updateTenant({ tagline: e.target.value })}
                  placeholder="Ex: Plataforma de Ativos Imobiliários"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block">Exibir Logotipo</span>
                  <span className="text-[11px] text-slate-500">
                    Desligado = 100% sem imagem de logo
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={tenant.showLogo}
                  onChange={(e) => updateTenant({ showLogo: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 cursor-pointer"
                />
              </div>

              {tenant.showLogo && (
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">URL do Logotipo do Cliente</label>
                  <input
                    type="text"
                    value={tenant.logoUrl || ''}
                    onChange={(e) => updateTenant({ logoUrl: e.target.value || null })}
                    placeholder="https://cliente.com.br/logo.png"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-medium text-slate-800"
                  />
                </div>
              )}
            </div>

            {/* Paleta de Cores */}
            <div className="space-y-2">
              <label className="font-bold text-slate-700 block">Paleta Rápida do Tema</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_SWATCHES.map((swatch) => {
                  const active = tenant.primaryColor === swatch.primary && tenant.accentColor === swatch.accent;
                  return (
                    <button
                      key={swatch.label}
                      onClick={() => updateTenant({ primaryColor: swatch.primary, accentColor: swatch.accent })}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                        active ? 'border-slate-900 bg-slate-100 shadow-xs' : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/10"
                        style={{ background: `linear-gradient(135deg, ${swatch.primary}, ${swatch.accent})` }}
                      />
                      <span>{swatch.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Monetização & Split Payment */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="font-black text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-emerald-600" /> Regras de Split Payment (Monetização de Parceiros)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Fee do Proprietário da Plataforma (%)</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  value={tenant.platformFeePct}
                  onChange={(e) => updateTenant({ platformFeePct: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-black text-slate-900"
                />
                <span className="text-[10px] text-slate-500 block">
                  Retido automaticamente na fonte a cada contratação na Área do Parceiro.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Comissão do Licenciado White-Label (%)</label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  step={0.5}
                  value={tenant.tenantFeePct}
                  onChange={(e) => updateTenant({ tenantFeePct: Math.max(0, Math.min(30, Number(e.target.value) || 0)) })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-black text-slate-900"
                />
                <span className="text-[10px] text-slate-500 block">
                  Opcional: permite ao comprador do White-Label também ganhar sobre serviços na sua base.
                </span>
              </div>
            </div>
          </div>

          {/* Feature Flags */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="font-black text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-slate-500" /> Módulos Habilitados para este Tenant
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {FEATURE_LABELS.map((feat) => (
                <label
                  key={feat.key}
                  className={`p-3 rounded-2xl border flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                    feat.key === 'adminSync'
                      ? 'border-amber-200 bg-amber-50/50'
                      : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/70'
                  }`}
                >
                  <div>
                    <span className="font-bold text-slate-900 flex items-center gap-1">
                      {feat.key === 'adminSync' && <Shield className="w-3.5 h-3.5 text-amber-600" />}
                      {feat.label}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{feat.desc}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={tenant.features[feat.key]}
                    onChange={(e) => updateTenant({ features: { [feat.key]: e.target.checked } })}
                    className="w-4 h-4 mt-0.5 accent-blue-600"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            onClick={resetTenant}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-slate-200/60"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Padrão</span>
          </button>

          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-xs font-black text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: tenant.primaryColor }}
          >
            Aplicar e Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
