import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { applyTenantDocumentBranding } from '../utils/brandingIcons';

export interface TenantFeatures {
  map: boolean;
  journey: boolean;
  partners: boolean;
  ledger: boolean;
  renovation: boolean;
  portfolio: boolean;
  copilot: boolean;
  adminSync: boolean;
}

export interface TenantConfig {
  id: string;
  slug: string;
  brandName: string;
  tagline: string;
  logoUrl: string | null;
  showLogo: boolean;
  primaryColor: string;
  accentColor: string;
  supportEmail: string;
  showIntroSplash: boolean;
  platformFeePct: number;
  tenantFeePct: number;
  features: TenantFeatures;
}

export const TENANT_PRESETS: Record<'whitelabel' | 'g2', TenantConfig> = {
  whitelabel: {
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'whitelabel',
    brandName: 'Auction OS',
    tagline: 'Inteligência em Leilões Imobiliários',
    logoUrl: null,
    showLogo: false,
    primaryColor: '#0f172a',
    accentColor: '#2563eb',
    supportEmail: 'suporte@suaempresa.com.br',
    showIntroSplash: false,
    platformFeePct: 10,
    tenantFeePct: 3,
    features: {
      map: true,
      journey: true,
      partners: true,
      ledger: true,
      renovation: true,
      portfolio: true,
      copilot: true,
      adminSync: false,
    },
  },
  g2: {
    id: '00000000-0000-4000-8000-000000000002',
    slug: 'g2',
    brandName: 'G2 AUCTION',
    tagline: 'O passo a passo para arrematar seu imóvel',
    logoUrl: '/logo/logo.jpeg',
    showLogo: true,
    primaryColor: '#ea580c',
    accentColor: '#dc2626',
    supportEmail: 'contato@g2auction.com.br',
    showIntroSplash: true,
    platformFeePct: 10,
    tenantFeePct: 0,
    features: {
      map: true,
      journey: true,
      partners: true,
      ledger: true,
      renovation: true,
      portfolio: true,
      copilot: true,
      adminSync: false,
    },
  },
};

const STORAGE_KEY = 'auction_wl_tenant_v1';

function resolveInitialTenant(): TenantConfig {
  let base: TenantConfig = { ...TENANT_PRESETS.g2, features: { ...TENANT_PRESETS.g2.features } };

  try {
    const savedRaw = localStorage.getItem(STORAGE_KEY);
    if (savedRaw) {
      const parsed = JSON.parse(savedRaw);
      base = {
        ...base,
        ...parsed,
        features: {
          ...base.features,
          ...(parsed.features || {}),
        },
      };
    }
  } catch {
    // ignore storage errors
  }

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const wlParam = params.get('wl');
    const tenantParam = params.get('tenant');
    const brandParam = params.get('brand');
    const adminParam = params.get('admin');

    if (wlParam === '1' || wlParam === 'true' || tenantParam === 'whitelabel') {
      base = {
        ...TENANT_PRESETS.whitelabel,
        features: { ...TENANT_PRESETS.whitelabel.features },
      };
    } else if (tenantParam === 'g2') {
      base = {
        ...TENANT_PRESETS.g2,
        features: { ...TENANT_PRESETS.g2.features },
      };
    }

    if (brandParam && brandParam.trim()) {
      base.brandName = brandParam.trim();
    }
    if (adminParam === '1' || adminParam === 'true') {
      base.features = { ...base.features, adminSync: true };
    }
  }

  return base;
}

export type TenantUpdatePayload = Omit<Partial<TenantConfig>, 'features'> & {
  features?: Partial<TenantFeatures>;
};

interface TenantContextValue {
  tenant: TenantConfig;
  updateTenant: (partial: TenantUpdatePayload) => void;
  applyPreset: (presetKey: 'whitelabel' | 'g2') => void;
  resetTenant: () => void;
  getShareableWhiteLabelUrl: () => string;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<TenantConfig>(resolveInitialTenant);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tenant));
    } catch {
      // ignore storage quota errors
    }

    return applyTenantDocumentBranding(tenant);
  }, [tenant]);

  const updateTenant = useCallback(
    (partial: TenantUpdatePayload) => {
      setTenant((prev) => ({
        ...prev,
        ...partial,
        features: {
          ...prev.features,
          ...(partial.features || {}),
        },
      }));
    },
    []
  );

  const applyPreset = useCallback((presetKey: 'whitelabel' | 'g2') => {
    const preset = TENANT_PRESETS[presetKey];
    setTenant({
      ...preset,
      features: { ...preset.features },
    });
  }, []);

  const resetTenant = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setTenant({
      ...TENANT_PRESETS.g2,
      features: { ...TENANT_PRESETS.g2.features },
    });
  }, []);

  const getShareableWhiteLabelUrl = useCallback(() => {
    if (typeof window === 'undefined') return '?wl=1';
    const url = new URL(window.location.href);
    url.searchParams.set('wl', '1');
    if (tenant.brandName && tenant.brandName !== TENANT_PRESETS.whitelabel.brandName && !tenant.showLogo) {
      url.searchParams.set('brand', tenant.brandName);
    } else {
      url.searchParams.delete('brand');
    }
    return url.toString();
  }, [tenant.brandName, tenant.showLogo]);

  return (
    <TenantContext.Provider
      value={{ tenant, updateTenant, applyPreset, resetTenant, getShareableWhiteLabelUrl }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error('useTenant deve ser utilizado dentro de TenantProvider');
  }
  return ctx;
}
