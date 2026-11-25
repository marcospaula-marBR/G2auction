import React from 'react';
import { Bot, Bell, Palette, ShieldCheck, Building2, LogIn, LogOut, Download } from 'lucide-react';
import { useTenant } from '../config/tenant';
import { useAuth } from '../config/auth';
import type { UserProfile } from '../types/auction';

interface HeaderProps {
  userProfile?: UserProfile;
  setUserProfile?: (profile: UserProfile) => void;
  onOpenCopilot: () => void;
  onOpenWhiteLabel: () => void;
  onOpenRadar: () => void;
  onOpenAuth: () => void;
  canInstallPwa?: boolean;
  onInstallPwa?: () => void;
  onReplayIntro?: () => void;
  unreadNotifications: number;
  version?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenCopilot,
  onOpenWhiteLabel,
  onOpenRadar,
  onOpenAuth,
  canInstallPwa,
  onInstallPwa,
  onReplayIntro,
  unreadNotifications,
  version = 'v3.11.1',
}) => {
  const { tenant } = useTenant();
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18 gap-3">
          {/* Brand Identity (100% White-Label Aware — Zero Logos when showLogo is false) */}
          <div
            onClick={tenant.showIntroSplash ? onReplayIntro : undefined}
            className={`flex items-center space-x-3 ${tenant.showIntroSplash ? 'cursor-pointer group' : ''}`}
            title={tenant.showIntroSplash ? 'Clique para rever a apresentação' : tenant.brandName}
          >
            {tenant.showLogo && tenant.logoUrl ? (
              <img
                src={tenant.logoUrl}
                alt={tenant.brandName}
                className="h-10 sm:h-11 w-auto object-contain rounded-xl shadow-2xs group-hover:scale-105 transition-transform"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-xs"
                style={{
                  background: `linear-gradient(135deg, ${tenant.primaryColor}, ${tenant.accentColor})`,
                }}
              >
                <Building2 className="w-4 h-4" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                {(!tenant.showLogo || !tenant.logoUrl) && (
                  <span className="font-black text-sm sm:text-base tracking-tight text-slate-900 truncate">
                    {tenant.brandName}
                  </span>
                )}
                <span className="bg-slate-900 text-slate-100 text-[10px] font-black px-2 py-0.5 rounded-md">
                  {version}
                </span>
                <span className="hidden lg:inline-flex bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full items-center gap-1 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" /> Base Multi-Bancos
                </span>
              </div>
              <p className="hidden sm:block text-[11px] text-slate-500 font-medium truncate">
                {tenant.tagline}
              </p>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            {/* Instalar App PWA (visível quando navegador permite prompt) */}
            {canInstallPwa && onInstallPwa && (
              <button
                onClick={onInstallPwa}
                className="bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-xs px-2.5 py-2 rounded-xl border border-sky-200 flex items-center space-x-1.5 transition-colors"
                title="Instalar App no dispositivo"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Instalar App</span>
              </button>
            )}

            {/* White-Label Studio */}
            <button
              onClick={onOpenWhiteLabel}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-2.5 sm:px-3 py-2 rounded-xl border border-slate-200 flex items-center space-x-1.5 transition-colors"
              title="Configurar White-Label / Modo Sem Logo"
            >
              <Palette className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden md:inline">White-Label</span>
            </button>

            {/* Radar IA & Notificações */}
            <button
              onClick={onOpenRadar}
              className="relative bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-2.5 sm:px-3 py-2 rounded-xl border border-slate-200 flex items-center space-x-1.5 transition-colors"
              title="Radar IA e Alertas no Celular"
            >
              <Bell className="w-3.5 h-3.5 text-slate-700" />
              <span className="hidden sm:inline">Radar IA</span>
              {unreadNotifications > 0 && (
                <span
                  className="text-white text-[10px] font-black px-1.5 py-0.2 rounded-full"
                  style={{ backgroundColor: tenant.primaryColor }}
                >
                  {unreadNotifications}
                </span>
              )}
            </button>

            {/* Login / Conta do Usuário */}
            {user ? (
              <div className="flex items-center bg-emerald-50 border border-emerald-200 rounded-xl pl-2.5 pr-1.5 py-1.5 gap-2">
                <span className="text-[11px] font-bold text-emerald-900 max-w-[90px] truncate hidden sm:inline">
                  {user.name}
                </span>
                <button
                  onClick={signOut}
                  className="text-emerald-700 hover:text-red-600 p-1 rounded-lg hover:bg-white transition-colors"
                  title={`Sair (${user.email})`}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-2.5 sm:px-3 py-2 rounded-xl border border-slate-200 flex items-center space-x-1.5 transition-colors"
                title="Entrar ou Criar Conta"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Entrar</span>
              </button>
            )}

            {/* Copilot IA */}
            {tenant.features.copilot && (
              <button
                onClick={onOpenCopilot}
                className="text-white font-bold text-xs px-3 py-2 rounded-xl shadow-sm flex items-center space-x-1.5 transition-all hover:opacity-95 active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${tenant.primaryColor}, ${tenant.accentColor})`,
                }}
              >
                <Bot className="w-4 h-4" />
                <span className="hidden sm:inline">Copilot IA</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
