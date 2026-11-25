function detectMimeType(url) {
  const lower = String(url || '').toLowerCase();
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

function sanitizeColor(color, fallback) {
  return /^#[0-9a-f]{3,8}$/i.test(String(color || '').trim()) ? String(color).trim() : fallback;
}

export default async function handler(req, res) {
  const host = (req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(':')[0].toLowerCase();
  const urlObj = new URL(req.url || '/api/manifest', `https://${host || 'localhost'}`);

  const tenantParam = (urlObj.searchParams.get('tenant') || '').trim().toLowerCase();
  let brandName = 'G2 AUCTION';
  let tagline = 'Leilões Imobiliários';
  let primaryColor = '#ea580c';
  let showLogo = true;
  let logoUrl = '/logo/logo.jpeg';

  if (tenantParam === 'whitelabel') {
    brandName = 'Auction OS';
    tagline = 'Inteligência em Leilões Imobiliários';
    primaryColor = '#0f172a';
    showLogo = false;
    logoUrl = '';
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const isCustomHost =
        host &&
        !host.endsWith('.vercel.app') &&
        !host.includes('localhost') &&
        !host.includes('127.0.0.1');

      let queryPath = '';
      if (isCustomHost) {
        queryPath = `custom_domain=eq.${encodeURIComponent(host)}`;
      } else if (tenantParam && tenantParam !== 'g2' && tenantParam !== 'whitelabel') {
        queryPath = `slug=eq.${encodeURIComponent(tenantParam)}`;
      }

      if (queryPath) {
        const resp = await fetch(
          `${supabaseUrl.replace(/\/$/, '')}/rest/v1/tenants?${queryPath}&active=eq.true&select=brand_name,tagline,logo_url,show_logo,primary_color&limit=1`,
          {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
            },
          }
        );
        if (resp.ok) {
          const rows = await resp.json();
          if (Array.isArray(rows) && rows.length > 0) {
            const row = rows[0];
            brandName = row.brand_name || brandName;
            tagline = row.tagline || tagline;
            primaryColor = sanitizeColor(row.primary_color, primaryColor);
            showLogo = Boolean(row.show_logo);
            logoUrl = row.logo_url || '';
          }
        }
      }
    } catch {
      // Fallback para query params / defaults
    }
  }

  const qBrand = urlObj.searchParams.get('brand');
  const qTagline = urlObj.searchParams.get('tagline');
  const qPrimary = urlObj.searchParams.get('primary');
  const qShowLogo = urlObj.searchParams.get('showLogo');
  const qLogo = urlObj.searchParams.get('logo');

  if (qBrand && qBrand.trim()) brandName = qBrand.trim().slice(0, 60);
  if (qTagline && qTagline.trim()) tagline = qTagline.trim().slice(0, 120);
  if (qPrimary) primaryColor = sanitizeColor(qPrimary, primaryColor);
  if (qShowLogo === '1' || qShowLogo === 'true') showLogo = true;
  if (qShowLogo === '0' || qShowLogo === 'false') showLogo = false;
  if (qLogo && qLogo.trim() && (qLogo.startsWith('/') || qLogo.startsWith('https://'))) {
    logoUrl = qLogo.trim();
  }

  let icons;
  if (showLogo && logoUrl && logoUrl !== '/logo/logo.jpeg') {
    const mime = detectMimeType(logoUrl);
    icons = [
      { src: logoUrl, sizes: '192x192', type: mime, purpose: 'any' },
      { src: logoUrl, sizes: '512x512', type: mime, purpose: 'any' },
    ];
  } else if (showLogo) {
    icons = [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ];
  } else {
    icons = [
      { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
      { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
    ];
  }

  const manifest = {
    name: `${brandName} — ${tagline}`,
    short_name: brandName.slice(0, 20),
    description: tagline,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f8fafc',
    theme_color: primaryColor,
    lang: 'pt-BR',
    icons,
  };

  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json(manifest);
}
