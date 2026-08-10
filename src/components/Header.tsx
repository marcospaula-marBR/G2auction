import React from 'react';
import { Bot, Bell, ShieldCheck, MessageSquare, ChevronDown } from 'lucide-react';
import type { UserProfile } from '../types/auction';

interface HeaderProps {
  userProfile: UserProfile;
  setUserProfile: (profile: UserProfile) => void;
  onOpenCopilot: () => void;
  onOpenWhatsApp: () => void;
  onReplayIntro?: () => void;
  unreadNotifications: number;
  version?: string;
}

export const Header: React.FC<HeaderProps> = ({
  userProfile,
  onOpenCopilot,
  onOpenWhatsApp,
  onReplayIntro,
  unreadNotifications,
  version = 'v1.9.5',
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Brand Logo, Version & Slogan */}
          <div className="flex items-center space-x-4">
            <div
              onClick={onReplayIntro}
              className="flex items-center space-x-2.5 cursor-pointer group"
              title="Clique para rever a apresentação do G2 AUCTION"
            >
              <img
                src="/logo/logo.jpeg"
                alt="G2 AUCTION"
                className="h-10 sm:h-12 w-auto object-contain rounded-xl shadow-xs group-hover:scale-105 transition-transform"
              />

              {/* Tag de Versao Sempre Visivel */}
              <span className="bg-slate-900 text-orange-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-orange-500/30 shadow-2xs">
                {version}
              </span>

              <div className="hidden md:block">
                <div className="flex items-center space-x-2">
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" /> IA Homologada
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-bold tracking-wide mt-0.5">
                  O passo a passo para arrematar seu imóvel
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="hidden md:flex items-center space-x-6 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200/80">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Capital Alocado</span>
              <span className="text-sm font-bold text-slate-800">R$ 1.240.000</span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">TIR Médio Anual</span>
              <span className="text-sm font-extrabold text-emerald-600">+ 34,2%</span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Perfil Ativo</span>
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                {userProfile.role} <ChevronDown className="w-3 h-3 text-slate-400" />
              </span>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex items-center space-x-3">
            
            {/* Copilot IA Voice Trigger */}
            <button
              onClick={onOpenCopilot}
              className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md shadow-orange-500/25 flex items-center space-x-2 transition-all transform active:scale-95"
            >
              <Bot className="w-4 h-4 animate-pulse" />
              <span>Copilot IA (Voz)</span>
            </button>

            {/* WhatsApp Trigger */}
            <button
              onClick={onOpenWhatsApp}
              className="bg-emerald-500 hover:bg-emerald-600 text-white p-2.5 rounded-xl shadow-sm flex items-center justify-center transition-all relative"
              title="Abrir Simulador WhatsApp"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-ping" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
            </button>

            {/* Notifications */}
            <button className="relative bg-slate-100 hover:bg-slate-200 text-slate-700 p-2.5 rounded-xl transition-all">
              <Bell className="w-4 h-4" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {unreadNotifications}
                </span>
              )}
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
