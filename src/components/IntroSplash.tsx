import React from 'react';
import { ArrowRight, ShieldCheck, Sparkles, ChevronDown, Building2 } from 'lucide-react';
import { useTenant } from '../config/tenant';

interface IntroSplashProps {
  onComplete: () => void;
  version?: string;
}

export const IntroSplash: React.FC<IntroSplashProps> = ({ onComplete, version = 'v3.11.0' }) => {
  const { tenant } = useTenant();

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col justify-between p-6 sm:p-10 select-none font-sans overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] sm:w-[600px] h-[380px] sm:h-[600px] rounded-full blur-3xl opacity-20 animate-pulse"
          style={{ backgroundColor: tenant.primaryColor }}
        />
      </div>

      {/* Top Header Bar */}
      <div className="relative z-10 flex items-center justify-between w-full max-w-md mx-auto">
        <div className="flex items-center space-x-2">
          <span className="bg-white/10 border border-white/20 text-white text-[11px] font-black px-3 py-1 rounded-full backdrop-blur-md">
            {tenant.brandName}
          </span>
          <span className="bg-slate-800/80 border border-slate-700 text-slate-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-md">
            {version}
          </span>
        </div>

        <span className="text-[10px] text-emerald-400 font-extrabold flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
          <ShieldCheck className="w-3 h-3" /> Multi-Bancos
        </span>
      </div>

      {/* Centerpiece */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center my-auto space-y-8 max-w-xl mx-auto w-full">
        {tenant.showLogo && tenant.logoUrl ? (
          <div
            onClick={onComplete}
            className="relative animate-float cursor-pointer group"
            title="Clique para avançar"
          >
            <div
              className="absolute -inset-4 rounded-3xl blur-xl opacity-45 group-hover:opacity-75 transition-opacity"
              style={{
                background: `linear-gradient(135deg, ${tenant.primaryColor}, ${tenant.accentColor})`,
              }}
            />
            <div className="relative bg-white p-5 sm:p-7 rounded-3xl shadow-2xl border-4 border-white/90 transform group-hover:scale-105 transition-transform">
              <img
                src={tenant.logoUrl}
                alt={tenant.brandName}
                className="w-52 sm:w-72 h-auto object-contain"
              />
            </div>
          </div>
        ) : (
          <div
            onClick={onComplete}
            className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl border border-white/20 cursor-pointer"
            style={{
              background: `linear-gradient(135deg, ${tenant.primaryColor}, ${tenant.accentColor})`,
            }}
          >
            <Building2 className="w-12 h-12 text-white" />
          </div>
        )}

        <div className="space-y-3 px-2">
          <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-300 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" style={{ color: tenant.primaryColor }} /> {tenant.brandName}
          </p>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight sm:leading-snug">
            "{tenant.tagline}"
          </h1>
        </div>
      </div>

      {/* Action Button */}
      <div className="relative z-10 flex flex-col items-center justify-center space-y-3 max-w-md mx-auto w-full">
        <button
          onClick={onComplete}
          className="w-full text-white font-black text-base py-4 px-6 rounded-2xl shadow-2xl flex items-center justify-center space-x-2.5 transition-all transform active:scale-95 group hover:opacity-95"
          style={{
            background: `linear-gradient(135deg, ${tenant.primaryColor}, ${tenant.accentColor})`,
          }}
        >
          <span>Acessar Oportunidades</span>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>

        <div className="flex items-center space-x-1 text-slate-400 text-xs font-bold pt-1">
          <ChevronDown className="w-4 h-4 animate-bounce" style={{ color: tenant.primaryColor }} />
          <span>Toque no botão para entrar na plataforma</span>
        </div>
      </div>
    </div>
  );
};
