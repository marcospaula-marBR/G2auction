import { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { AICopilot } from './components/AICopilot';
import { PropertyDetailModal } from './components/PropertyDetailModal';
import { MaxBidCalculator } from './components/MaxBidCalculator';
import { InvestmentLedger } from './components/InvestmentLedger';
import { RenovationManager } from './components/RenovationManager';
import { PartnerNetwork } from './components/PartnerNetwork';
import { PortfolioDashboard } from './components/PortfolioDashboard';
import { PropertyReportModal } from './components/PropertyReportModal';
import { IntroSplash } from './components/IntroSplash';
import { PropertyCatalogPage } from './components/PropertyCatalogPage';
import { JourneyPage } from './components/JourneyPage';
import { WhiteLabelStudioModal } from './components/WhiteLabelStudioModal';
import { AuthModal } from './components/AuthModal';
import { RadarIAModal } from './components/RadarIAModal';
import { TenantProvider, useTenant } from './config/tenant';
import { AuthProvider, useAuth } from './config/auth';

import { mockProperties } from './data/mockProperties';
import { mockParceiros } from './data/mockParceiros';
import type { Property, LedgerEntry, UserProfile } from './types/auction';
import { queryPropertiesFromSupabase, autoSeedDefaultCsvFromPublic } from './lib/supabaseClient';
import { adaptCatalogItemToProperty } from './utils/propertyAdapter';
import {
  registerServiceWorker,
  type BeforeInstallPromptEvent,
} from './utils/pwaManager';
import {
  DEFAULT_RADAR_PROFILE,
  loadRadarProfile,
  saveRadarProfile,
  scorePropertiesAgainstRadar,
  type UserRadarProfile,
} from './utils/radarMatchEngine';
import { Wallet, Wrench, Users, PieChart, Route, Landmark } from 'lucide-react';

const APP_VERSION = 'v3.10.0';
const INTRO_SEEN_KEY = 'auction_intro_seen_v1';

function AppContent() {
  const { tenant } = useTenant();
  const { user } = useAuth();

  const [properties, setProperties] = useState<Property[]>(mockProperties);
  const [selectedProperty, setSelectedProperty] = useState<Property | undefined>(mockProperties[0]);

  // PWA Service Worker + Install Prompt
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    registerServiceWorker();

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  // Carrega amostra leve (60 itens) no boot; PropertyCatalogPage alimenta a lista ativa via onPropertiesLoaded
  useEffect(() => {
    async function loadInitialSample() {
      try {
        await autoSeedDefaultCsvFromPublic();
        const res = await queryPropertiesFromSupabase({ pageSize: 60, state: 'SP' });
        if (res && res.data && res.data.length > 0) {
          const adapted = res.data.map((p: any, idx: number) => adaptCatalogItemToProperty(p, idx));
          setProperties(adapted);
          setSelectedProperty((prev) => prev || adapted[0]);
        }
      } catch (err: any) {
        console.warn('[App Boot Load]', err.message);
      }
    }
    loadInitialSample();
  }, []);

  const [isIntroVisible, setIsIntroVisible] = useState<boolean>(() => {
    if (!tenant.showIntroSplash) return false;
    try {
      return !localStorage.getItem(INTRO_SEEN_KEY);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!tenant.showIntroSplash) {
      setIsIntroVisible(false);
    }
  }, [tenant.showIntroSplash]);

  type MainTab = 'imoveis' | 'jornada' | 'partners' | 'ledger' | 'renovation' | 'portfolio';
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('imoveis');

  // Modais
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isWhiteLabelOpen, setIsWhiteLabelOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isRadarOpen, setIsRadarOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isMaxBidOpen, setIsMaxBidOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Perfil do Radar IA (carregado do Supabase se logado, ou localStorage)
  const [radarProfile, setRadarProfile] = useState<UserRadarProfile>(DEFAULT_RADAR_PROFILE);

  useEffect(() => {
    loadRadarProfile(user?.id, user?.isDemoSession).then((loaded) => {
      setRadarProfile(loaded);
    });
  }, [user?.id, user?.isDemoSession]);

  const radarMatches = useMemo(
    () => scorePropertiesAgainstRadar(properties, radarProfile),
    [properties, radarProfile]
  );

  // Livro Caixa
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([
    {
      id: 'l-1',
      propertyId: 'prop-1',
      category: 'Arrematação',
      amount: 446400,
      date: '2026-08-01',
      supplier: 'Caixa / Mega Leilões',
      description: 'Pagamento de arrematação do imóvel no Cambuí',
      provenance: 'DOCUMENT_EXTRACTED',
    },
    {
      id: 'l-2',
      propertyId: 'prop-1',
      category: 'Comissão Leiloeiro',
      amount: 22320,
      date: '2026-08-01',
      supplier: 'Mega Leilões Oficial',
      description: 'Comissão de 5% sobre arrematação',
      provenance: 'DOCUMENT_EXTRACTED',
    },
    {
      id: 'l-3',
      propertyId: 'prop-1',
      category: 'Mão de Obra Reforma',
      amount: 2300,
      date: '2026-08-05',
      supplier: 'Pedreiro Silva',
      description: 'Primeira etapa demolição e pintura',
      provenance: 'VOICE_REGISTERED',
    },
  ]);

  const [userProfile] = useState<UserProfile>({
    id: 'usr-1',
    name: 'Investidor',
    role: 'Flipper Profissional',
    totalCapital: 2500000,
    allocatedCapital: 1240000,
    activeInvestmentsCount: 3,
    targetRoi: 30,
    targetIrr: 34.2,
  });

  const handleCompleteIntro = () => {
    try {
      localStorage.setItem(INTRO_SEEN_KEY, '1');
    } catch {
      // ignore
    }
    setIsIntroVisible(false);
  };

  const handleAddLedgerEntry = (entry: Omit<LedgerEntry, 'id'>) => {
    const newEntry: LedgerEntry = { ...entry, id: Date.now().toString() };
    setLedgerEntries((prev) => [newEntry, ...prev]);
  };

  const handleRegisterVoiceExpense = (voiceText: string) => {
    handleAddLedgerEntry({
      propertyId: selectedProperty?.id || properties[0].id,
      category: 'Mão de Obra Reforma',
      amount: 2300,
      date: new Date().toISOString().split('T')[0],
      supplier: 'Lançado por Voz',
      description: `Lançamento por Voz: "${voiceText}"`,
      provenance: 'VOICE_REGISTERED',
    });
  };

  const navItems = useMemo(() => {
    const items: { id: MainTab; label: string; icon: React.ElementType; visible: boolean; highlight?: boolean }[] = [
      { id: 'imoveis', label: 'Imóveis & Mapa', icon: Landmark, visible: true },
      { id: 'jornada', label: 'Minha Jornada', icon: Route, visible: tenant.features.journey, highlight: true },
      { id: 'partners', label: 'Parceiros', icon: Users, visible: tenant.features.partners },
      { id: 'ledger', label: 'Livro Caixa', icon: Wallet, visible: tenant.features.ledger },
      { id: 'renovation', label: 'Campo & Obra', icon: Wrench, visible: tenant.features.renovation },
      { id: 'portfolio', label: 'Carteira', icon: PieChart, visible: tenant.features.portfolio },
    ];
    return items.filter((item) => item.visible);
  }, [tenant.features]);

  useEffect(() => {
    if (!navItems.some((item) => item.id === activeMainTab)) {
      setActiveMainTab('imoveis');
    }
  }, [navItems, activeMainTab]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {isIntroVisible && (
        <IntroSplash version={APP_VERSION} onComplete={handleCompleteIntro} />
      )}

      <Header
        onOpenCopilot={() => setIsCopilotOpen(true)}
        onOpenWhiteLabel={() => setIsWhiteLabelOpen(true)}
        onOpenRadar={() => setIsRadarOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        canInstallPwa={Boolean(deferredPrompt)}
        onInstallPwa={handleInstallPwa}
        onReplayIntro={() => setIsIntroVisible(true)}
        unreadNotifications={radarMatches.length}
        version={APP_VERSION}
      />

      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 px-4 sm:px-8 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto scrollbar-none gap-2">
          <div className="flex items-center space-x-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeMainTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveMainTab(item.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 flex-shrink-0 ${
                    isActive
                      ? 'text-white shadow-sm'
                      : item.highlight
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  style={
                    isActive
                      ? {
                          background: item.highlight
                            ? 'linear-gradient(135deg, #059669, #0d9488)'
                            : `linear-gradient(135deg, ${tenant.primaryColor}, ${tenant.accentColor})`,
                        }
                      : undefined
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-6">
        {activeMainTab === 'imoveis' && (
          <PropertyCatalogPage
            onPropertiesLoaded={(adapted) => {
              if (adapted.length > 0) {
                setProperties(adapted);
                setSelectedProperty((prev) => prev || adapted[0]);
              }
            }}
            onOpenJourney={(prop) => {
              const adapted = adaptCatalogItemToProperty(prop);
              setSelectedProperty(adapted);
              setActiveMainTab('jornada');
            }}
            onOpenDetail360={(prop) => {
              setSelectedProperty(prop);
              setIsDetailModalOpen(true);
            }}
            onOpenMaxBid={(prop) => {
              setSelectedProperty(prop);
              setIsMaxBidOpen(true);
            }}
          />
        )}

        {activeMainTab === 'jornada' && selectedProperty && (
          <JourneyPage
            property={selectedProperty}
            availableProperties={properties}
            onSelectProperty={setSelectedProperty}
            onOpenMaxBid={(p) => {
              setSelectedProperty(p);
              setIsMaxBidOpen(true);
            }}
            onNavigateToCatalog={() => setActiveMainTab('imoveis')}
            onNavigateToMap={() => setActiveMainTab('imoveis')}
          />
        )}

        {activeMainTab === 'jornada' && !selectedProperty && (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
            <Route className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-black text-slate-700 text-lg mb-1">Selecione um Imóvel</h3>
            <p className="text-sm text-slate-500">
              Acesse a aba "Imóveis & Mapa" e escolha um imóvel para iniciar sua jornada.
            </p>
            <button
              onClick={() => setActiveMainTab('imoveis')}
              className="mt-4 px-5 py-2.5 text-white font-bold text-sm rounded-xl"
              style={{ backgroundColor: tenant.primaryColor }}
            >
              Ver Catálogo
            </button>
          </div>
        )}

        {activeMainTab === 'partners' && <PartnerNetwork partners={mockParceiros} />}

        {activeMainTab === 'ledger' && selectedProperty && (
          <InvestmentLedger
            property={selectedProperty}
            entries={ledgerEntries}
            onAddEntry={handleAddLedgerEntry}
            onOpenVoiceModal={() => setIsCopilotOpen(true)}
          />
        )}

        {activeMainTab === 'renovation' && selectedProperty && (
          <RenovationManager property={selectedProperty} />
        )}

        {activeMainTab === 'portfolio' && (
          <PortfolioDashboard
            userProfile={userProfile}
            properties={properties}
            onSelectProperty={(p) => {
              setSelectedProperty(p);
              setIsDetailModalOpen(true);
            }}
          />
        )}
      </main>

      {/* Modais Globais */}
      {isCopilotOpen && (
        <AICopilot
          isOpen={isCopilotOpen}
          onClose={() => setIsCopilotOpen(false)}
          properties={properties}
          onSelectProperty={(p) => {
            setSelectedProperty(p);
            setIsDetailModalOpen(true);
          }}
          onRegisterVoiceExpense={handleRegisterVoiceExpense}
        />
      )}

      <WhiteLabelStudioModal
        isOpen={isWhiteLabelOpen}
        onClose={() => setIsWhiteLabelOpen(false)}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <RadarIAModal
        isOpen={isRadarOpen}
        onClose={() => setIsRadarOpen(false)}
        profile={radarProfile}
        onChangeProfile={setRadarProfile}
        onSaveProfile={() => saveRadarProfile(radarProfile, user?.id, tenant.id, user?.isDemoSession)}
        matches={radarMatches}
        canInstallPwa={Boolean(deferredPrompt)}
        onInstallPwa={handleInstallPwa}
        onOpenAuth={() => {
          setIsRadarOpen(false);
          setIsAuthOpen(true);
        }}
        onSelectProperty={(p) => {
          setSelectedProperty(p);
          setIsDetailModalOpen(true);
        }}
        onOpenJourney={(p) => {
          setSelectedProperty(p);
          setActiveMainTab('jornada');
        }}
      />

      {isDetailModalOpen && selectedProperty && (
        <PropertyDetailModal
          property={selectedProperty}
          onClose={() => setIsDetailModalOpen(false)}
          onOpenMaxBid={() => setIsMaxBidOpen(true)}
          onOpenReport={() => setIsReportOpen(true)}
        />
      )}

      {isMaxBidOpen && selectedProperty && (
        <MaxBidCalculator
          property={selectedProperty}
          onClose={() => setIsMaxBidOpen(false)}
        />
      )}

      {isReportOpen && selectedProperty && (
        <PropertyReportModal
          property={selectedProperty}
          onClose={() => setIsReportOpen(false)}
        />
      )}

      {/* Footer (100% White-Label Aware) */}
      <footer className="bg-white border-t border-slate-200 py-5 px-4 text-center text-xs text-slate-500 mt-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5 font-bold text-slate-800">
            {tenant.showLogo && tenant.logoUrl && (
              <img src={tenant.logoUrl} alt={tenant.brandName} className="h-7 w-auto object-contain rounded-lg" />
            )}
            <span>{tenant.brandName}</span>
            <span className="text-slate-400 font-normal">— {tenant.tagline}</span>
          </div>
          <p>
            © {new Date().getFullYear()} {tenant.brandName} ({APP_VERSION}). Plataforma de Leilões Imobiliários.
          </p>
        </div>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <TenantProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </TenantProvider>
  );
}

export default App;
