import type { TenantConfig } from '../config/tenant';

function computeInitials(brandName: string): string {
  const words = (brandName || 'AU')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'AU';
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function buildMonogramIconDataUrl(
  brandName: string,
  primaryColor: string,
  accentColor: string
): string {
  const initials = computeInitials(brandName);
  const p = primaryColor || '#0f172a';
  const a = accentColor || '#2563eb';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${p}"/><stop offset="100%" stop-color="${a}"/></linearGradient></defs><rect width="512" height="512" rx="112" fill="url(#g)"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-weight="900" font-size="210" letter-spacing="-6">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getTenantIconUrl(
  tenant: Pick<TenantConfig, 'brandName' | 'logoUrl' | 'showLogo' | 'primaryColor' | 'accentColor'>
): string {
  if (tenant.showLogo && tenant.logoUrl) {
    if (tenant.logoUrl === '/logo/logo.jpeg') {
      return '/icon-192.png';
    }
    return tenant.logoUrl;
  }
  return buildMonogramIconDataUrl(tenant.brandName, tenant.primaryColor, tenant.accentColor);
}

function detectMimeType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.startsWith('data:image/svg+xml') || lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.startsWith('data:image/jpeg') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.startsWith('data:image/webp') || lower.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

function ensureHeadLink(rel: string): HTMLLinkElement {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  return el;
}

export function applyTenantDocumentBranding(tenant: TenantConfig): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return () => {};
  }

  document.title = `${tenant.brandName} — ${tenant.tagline}`;
  document.documentElement.style.setProperty('--brand-primary', tenant.primaryColor);
  document.documentElement.style.setProperty('--brand-accent', tenant.accentColor);

  let themeMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!themeMeta) {
    themeMeta = document.createElement('meta');
    themeMeta.name = 'theme-color';
    document.head.appendChild(themeMeta);
  }
  themeMeta.content = tenant.primaryColor;

  const iconUrl = getTenantIconUrl(tenant);
  const iconType = detectMimeType(iconUrl);

  const favLink = ensureHeadLink('icon');
  favLink.type = iconType;
  favLink.href = iconUrl;

  const appleLink = ensureHeadLink('apple-touch-icon');
  appleLink.href = tenant.showLogo && tenant.logoUrl === '/logo/logo.jpeg' ? '/apple-touch-icon.png' : iconUrl;

  const manifestLink = ensureHeadLink('manifest');
  const isLocalhost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isInlineDataUpload = iconUrl.startsWith('data:image/') && tenant.showLogo;

  let blobUrlToRevoke: string | null = null;

  if (!isLocalhost && !isInlineDataUpload) {
    const params = new URLSearchParams();
    params.set('tenant', tenant.slug || 'g2');
    params.set('brand', tenant.brandName);
    params.set('tagline', tenant.tagline);
    params.set('primary', tenant.primaryColor);
    params.set('accent', tenant.accentColor);
    params.set('showLogo', tenant.showLogo ? '1' : '0');
    if (tenant.showLogo && tenant.logoUrl && tenant.logoUrl !== '/logo/logo.jpeg') {
      params.set('logo', tenant.logoUrl);
    }
    manifestLink.href = `/api/manifest?${params.toString()}`;
  } else {
    const origin = window.location.origin;
    const isDefaultG2 = tenant.showLogo && (!tenant.logoUrl || tenant.logoUrl === '/logo/logo.jpeg');
    const resolvedIcon512 = isDefaultG2
      ? `${origin}/icon-512.png`
      : iconUrl.startsWith('/')
      ? `${origin}${iconUrl}`
      : iconUrl;
    const resolvedIcon192 = isDefaultG2
      ? `${origin}/icon-192.png`
      : iconUrl.startsWith('/')
      ? `${origin}${iconUrl}`
      : iconUrl;

    const manifestPayload = {
      name: `${tenant.brandName} — ${tenant.tagline}`,
      short_name: tenant.brandName.slice(0, 20),
      description: tenant.tagline || 'Plataforma inteligente para leilões imobiliários.',
      start_url: `${origin}/`,
      scope: `${origin}/`,
      display: 'standalone',
      orientation: 'portrait-primary',
      background_color: '#f8fafc',
      theme_color: tenant.primaryColor,
      lang: 'pt-BR',
      icons: isDefaultG2
        ? [
            { src: resolvedIcon192, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: resolvedIcon512, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ]
        : [
            { src: resolvedIcon192, sizes: '192x192', type: iconType, purpose: 'any' },
            { src: resolvedIcon512, sizes: '512x512', type: iconType, purpose: 'any' },
          ],
    };

    try {
      const blob = new Blob([JSON.stringify(manifestPayload)], { type: 'application/manifest+json' });
      blobUrlToRevoke = URL.createObjectURL(blob);
      manifestLink.href = blobUrlToRevoke;
    } catch {
      manifestLink.href = '/manifest.webmanifest';
    }
  }

  return () => {
    if (blobUrlToRevoke) {
      URL.revokeObjectURL(blobUrlToRevoke);
    }
  };
}
