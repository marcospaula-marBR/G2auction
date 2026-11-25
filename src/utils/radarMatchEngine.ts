import type { Property } from '../types/auction';
import { supabase } from '../lib/supabaseClient';
import { formatCurrencyBRL } from './financial';

export interface UserRadarProfile {
  name: string;
  states: string[];
  cityQuery: string;
  banks: string[];
  propertyTypes: string[];
  maxPrice: number;
  minDiscountPct: number;
  requireFinancing: boolean;
  acceptOccupied: boolean;
  priceTolerancePct: number;
  discountTolerancePp: number;
  notifyPwaPush: boolean;
  notifyTelegram: boolean;
  telegramChatId: string;
  notifyEmail: boolean;
  notifyWhatsappPro: boolean;
  whatsappPhone: string;
  frequency: 'IMMEDIATE' | 'DAILY' | 'WEEKLY';
  active: boolean;
}

export interface RadarMatchResult {
  property: Property;
  matchScore: number;
  matchType: 'EXACT' | 'NEAR';
  reasons: string[];
  aiBrief: string;
}

export const DEFAULT_RADAR_PROFILE: UserRadarProfile = {
  name: 'Meu Radar Principal',
  states: ['SP'],
  cityQuery: '',
  banks: [],
  propertyTypes: [],
  maxPrice: 450000,
  minDiscountPct: 35,
  requireFinancing: false,
  acceptOccupied: true,
  priceTolerancePct: 15,
  discountTolerancePp: 5,
  notifyPwaPush: true,
  notifyTelegram: false,
  telegramChatId: '',
  notifyEmail: true,
  notifyWhatsappPro: false,
  whatsappPhone: '',
  frequency: 'IMMEDIATE',
  active: true,
};

const LOCAL_RADAR_KEY = 'auction_radar_profile_v2';

function normalizeText(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseCityList(cityQuery: string): string[] {
  return (cityQuery || '')
    .split(/[,;|\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeBankTag(property: Property): string {
  const b = (property.bankName || property.originBank || '').toUpperCase();
  if (b.includes('CAIXA')) return 'CAIXA';
  if (b.includes('SANTANDER')) return 'SANTANDER';
  if (b.includes('BRADESCO')) return 'BRADESCO';
  if (b.includes('ITAÚ') || b.includes('ITAU')) return 'ITAU';
  if (b.includes('BRASIL') || b.includes('BB')) return 'BB';
  if (b.includes('JUDICIAL')) return 'JUDICIAL';
  if (b.includes('ZUK')) return 'ZUK';
  if (b.includes('MEGA')) return 'MEGA';
  return b || 'OUTRO';
}

export function scorePropertiesAgainstRadar(
  properties: Property[],
  profile: UserRadarProfile
): RadarMatchResult[] {
  if (!profile.active) return [];

  const maxPrice = profile.maxPrice > 0 ? profile.maxPrice : Infinity;
  const maxPriceWithTolerance =
    maxPrice === Infinity ? Infinity : maxPrice * (1 + (profile.priceTolerancePct || 0) / 100);
  const minDisc = profile.minDiscountPct || 0;
  const minDiscWithTolerance = Math.max(0, minDisc - (profile.discountTolerancePp || 0));
  const cityTargets = parseCityList(profile.cityQuery).map(normalizeText);

  const results: RadarMatchResult[] = [];

  for (const prop of properties) {
    const price = prop.secondAuctionPrice || prop.firstAuctionPrice || 0;
    if (price <= 0) continue;

    // Filtros rígidos de UF, Banco, Tipo, Financiamento e Ocupação
    if (profile.states.length > 0 && !profile.states.includes((prop.address.state || '').toUpperCase())) {
      continue;
    }

    if (profile.banks.length > 0) {
      const bankTag = normalizeBankTag(prop);
      if (!profile.banks.includes(bankTag)) continue;
    }

    if (profile.propertyTypes.length > 0) {
      const propCat = normalizeText(prop.category || '');
      const propTitle = normalizeText(prop.title || '');
      const matchesType = profile.propertyTypes.some((t) => {
        const nt = normalizeText(t);
        return propCat.includes(nt) || propTitle.includes(nt);
      });
      if (!matchesType) continue;
    }

    if (profile.requireFinancing && !prop.isFinancable) {
      continue;
    }

    if (!profile.acceptOccupied && prop.occupancyStatus === 'Ocupado') {
      continue;
    }

    // Preço e Desconto (Exato vs Próximo)
    if (price > maxPriceWithTolerance) continue;

    const discount = prop.apparentDiscountPercentage || 0;
    if (discount < minDiscWithTolerance) continue;

    const cityName = normalizeText(prop.address.city || '');
    const cityExact = cityTargets.length === 0 || cityTargets.some((c) => cityName.includes(c));
    if (cityTargets.length > 0 && !cityExact) {
      // Caso o usuário digite cidade(s) específica(s), mantém apenas correspondências da lista
      continue;
    }

    const priceExact = price <= maxPrice;
    const discountExact = discount >= minDisc;
    const isExact = priceExact && discountExact && cityExact;

    let score = 88;
    const reasons: string[] = [];

    if (priceExact) {
      score += 6;
      reasons.push(`Dentro do teto (${formatCurrencyBRL(price)})`);
    } else {
      const overPct = Math.round(((price - maxPrice) / maxPrice) * 100);
      score -= Math.min(18, overPct);
      reasons.push(`+${overPct}% acima do teto (dentro da tolerância)`);
    }

    if (discountExact) {
      const bonus = Math.min(6, Math.floor((discount - minDisc) / 5));
      score += bonus;
      reasons.push(`${discount}% de deságio`);
    } else {
      const diffPp = Math.round(minDisc - discount);
      score -= Math.min(12, diffPp * 2);
      reasons.push(`${discount}% de deságio (${diffPp} p.p. abaixo do alvo)`);
    }

    if (prop.isFinancable) reasons.push('Aceita financiamento');
    if (prop.occupancyStatus === 'Desocupado') {
      score += 2;
      reasons.push('Imóvel desocupado');
    }

    const clampedScore = Math.max(60, Math.min(99, Math.round(score)));
    const matchType: 'EXACT' | 'NEAR' = isExact ? 'EXACT' : 'NEAR';

    const aiBrief =
      matchType === 'EXACT'
        ? `Match direto em ${prop.address.city}/${prop.address.state}: lance mínimo de ${formatCurrencyBRL(price)} com ${discount}% de desconto sobre a avaliação (${formatCurrencyBRL(prop.appraisalValue)}).`
        : `Oportunidade próxima do seu alvo em ${prop.address.city}/${prop.address.state} (${formatCurrencyBRL(price)}, ${discount}% de deságio). Vale avaliar se a margem compensa a flexibilização.`;

    results.push({
      property: prop,
      matchScore: clampedScore,
      matchType,
      reasons,
      aiBrief,
    });
  }

  return results
    .sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return (b.property.apparentDiscountPercentage || 0) - (a.property.apparentDiscountPercentage || 0);
    })
    .slice(0, 20);
}

export async function loadRadarProfile(userId?: string, isDemo?: boolean): Promise<UserRadarProfile> {
  if (supabase && userId && !isDemo) {
    try {
      const { data, error } = await supabase
        .from('user_alert_profiles')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const mapped: UserRadarProfile = {
          name: data.name || 'Meu Radar Principal',
          states: Array.isArray(data.states) && data.states.length > 0 ? data.states : ['SP'],
          cityQuery: Array.isArray(data.cities) && data.cities.length > 0 ? data.cities.join(', ') : '',
          banks: Array.isArray(data.banks) ? data.banks : [],
          propertyTypes: Array.isArray(data.property_types) ? data.property_types : [],
          maxPrice: Number(data.max_price) || 450000,
          minDiscountPct: Number(data.min_discount_pct) || 35,
          requireFinancing: Boolean(data.require_financing),
          acceptOccupied: data.accept_occupied !== false,
          priceTolerancePct: Number(data.price_tolerance_pct ?? 15),
          discountTolerancePp: Number(data.discount_tolerance_pp ?? 5),
          notifyPwaPush: data.notify_pwa_push !== false,
          notifyTelegram: Boolean(data.notify_telegram),
          telegramChatId: data.telegram_chat_id || '',
          notifyEmail: data.notify_email !== false,
          notifyWhatsappPro: Boolean(data.notify_whatsapp_pro),
          whatsappPhone: data.whatsapp_phone || '',
          frequency: (data.frequency as UserRadarProfile['frequency']) || 'IMMEDIATE',
          active: data.active !== false,
        };
        try {
          localStorage.setItem(LOCAL_RADAR_KEY, JSON.stringify(mapped));
        } catch {
          // ignore
        }
        return mapped;
      }
    } catch (err) {
      console.warn('[Radar Load Supabase Fallback]', err);
    }
  }

  try {
    const raw = localStorage.getItem(LOCAL_RADAR_KEY);
    if (raw) {
      return { ...DEFAULT_RADAR_PROFILE, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_RADAR_PROFILE };
}

function isValidUuid(val?: string): boolean {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
}

export async function saveRadarProfile(
  profile: UserRadarProfile,
  userId?: string,
  tenantId?: string,
  isDemo?: boolean
): Promise<{ savedToSupabase: boolean; error?: string }> {
  try {
    localStorage.setItem(LOCAL_RADAR_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }

  if (supabase && userId && !isDemo) {
    try {
      const payload = {
        tenant_id: isValidUuid(tenantId) ? tenantId : null,
        user_id: userId,
        name: profile.name || 'Meu Radar Principal',
        states: profile.states,
        cities: parseCityList(profile.cityQuery),
        property_types: profile.propertyTypes,
        banks: profile.banks,
        max_price: profile.maxPrice,
        min_discount_pct: profile.minDiscountPct,
        require_financing: profile.requireFinancing,
        accept_occupied: profile.acceptOccupied,
        price_tolerance_pct: profile.priceTolerancePct,
        discount_tolerance_pp: profile.discountTolerancePp,
        notify_pwa_push: profile.notifyPwaPush,
        notify_telegram: profile.notifyTelegram,
        telegram_chat_id: profile.telegramChatId || null,
        notify_email: profile.notifyEmail,
        notify_whatsapp_pro: profile.notifyWhatsappPro,
        whatsapp_phone: profile.whatsappPhone || null,
        frequency: profile.frequency,
        active: profile.active,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_alert_profiles')
        .upsert(payload, { onConflict: 'user_id,name' });

      if (error) {
        return { savedToSupabase: false, error: error.message };
      }
      return { savedToSupabase: true };
    } catch (err: any) {
      return { savedToSupabase: false, error: err?.message || 'Erro ao salvar no Supabase' };
    }
  }

  return { savedToSupabase: false };
}
