import React from 'react';
import { MapPin, Tag } from 'lucide-react';
import { formatCurrencyBRL } from '../utils/financial';
import { formatStandardPropertyId, extractCleanPropertyAddress } from '../utils/propertyAuctionHelper';

export interface PropertyHeaderSummaryProps {
  property: any;
  contextTitle?: string;
  contextBadge?: string;
  showKpis?: boolean;
}

export const getBankBadgeConfig = (property: any) => {
  const source = String(property?.source || property?.bank || property?.acquisitionType || '').toUpperCase();
  const title = String(property?.title || '').toUpperCase();
  const desc = String(property?.description || '').toUpperCase();

  if (source.includes('SANTANDER') || title.includes('SANTANDER') || desc.includes('SANTANDER')) {
    return {
      name: 'Banco Santander',
      shortName: 'SANTANDER',
      emoji: '🔴',
      badgeClass: 'bg-red-600 text-white border-red-700 shadow-2xs',
      bgLight: 'bg-red-50 border-red-200 text-red-700',
    };
  }

  if (source.includes('BRADESCO') || title.includes('BRADESCO') || desc.includes('BRADESCO')) {
    return {
      name: 'Banco Bradesco',
      shortName: 'BRADESCO',
      emoji: '🟥',
      badgeClass: 'bg-red-700 text-white border-red-800 shadow-2xs',
      bgLight: 'bg-red-50 border-red-200 text-red-800',
    };
  }

  if (source.includes('BRASIL') || source.includes('BB') || title.includes('BANCO DO BRASIL') || desc.includes('BANCO DO BRASIL')) {
    return {
      name: 'Banco do Brasil',
      shortName: 'BANCO DO BRASIL',
      emoji: '🟡',
      badgeClass: 'bg-yellow-400 text-blue-950 border-yellow-500 font-black shadow-2xs',
      bgLight: 'bg-yellow-50 border-yellow-300 text-blue-900',
    };
  }

  if (source.includes('ITAU') || source.includes('ITAÚ') || title.includes('ITAU')) {
    return {
      name: 'Banco Itaú',
      shortName: 'ITAÚ',
      emoji: '🟧',
      badgeClass: 'bg-orange-600 text-white border-orange-700 shadow-2xs',
      bgLight: 'bg-orange-50 border-orange-200 text-orange-800',
    };
  }

  if (source.includes('JUDICIAL') || title.includes('JUDICIAL') || desc.includes('VARA CIVEL') || desc.includes('FALENCIA')) {
    return {
      name: 'Leilão Judicial',
      shortName: 'JUDICIAL',
      emoji: '⚖️',
      badgeClass: 'bg-purple-700 text-white border-purple-800 shadow-2xs',
      bgLight: 'bg-purple-50 border-purple-200 text-purple-800',
    };
  }

  // Padrão Caixa Econômica Federal
  return {
    name: 'Caixa Econômica Federal',
    shortName: 'CAIXA',
    emoji: '🏛️',
    badgeClass: 'bg-blue-600 text-white border-blue-700 shadow-2xs',
    bgLight: 'bg-blue-50 border-blue-200 text-blue-800',
  };
};

export const PropertyHeaderSummary: React.FC<PropertyHeaderSummaryProps> = ({
  property,
  contextTitle,
  contextBadge,
  showKpis = true,
}) => {
  if (!property) return null;

  const bankInfo = getBankBadgeConfig(property);
  const standardId = formatStandardPropertyId(property);
  const cleanAddress = extractCleanPropertyAddress(property) || property.address?.street || property.address || '';
  const city = property.city || property.address?.city || 'São Paulo';
  const state = property.state || property.address?.state || 'SP';
  const neighborhood = property.neighborhood || property.address?.neighborhood || '';
  const propertyTitle = property.title || cleanAddress || 'Imóvel em Leilão';

  const saleVal = Number(property.secondAuctionPrice || property.current_minimum_value || property.sale_value || 0);
  const appraisalVal = Number(property.appraisalValue || property.appraisal_value || 0);
  const discountPct = Number(property.apparentDiscountPercentage ?? property.discount_percentage ?? 0);
  const occupancy = property.occupancyStatus || property.occupancy_status || 'Ocupação: N/I';

  return (
    <div className="space-y-2.5">
      {/* Linha 1: Badges de Banco, ID do Imóvel, Modalidade e Contexto */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Badge do Banco Oficial */}
        <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-md border ${bankInfo.badgeClass}`}>
          <span>{bankInfo.emoji}</span>
          <span>{bankInfo.shortName}</span>
        </span>

        {/* ID Padrão do Imóvel */}
        <span className="inline-flex items-center gap-1 text-[11px] font-black font-mono px-2 py-0.5 rounded-md bg-slate-900 text-orange-400 border border-slate-700 shadow-2xs">
          <Tag className="w-3 h-3 text-orange-400" />
          <span>{standardId}</span>
        </span>

        {/* Modalidade / Tipo de Aquisição */}
        {property.acquisitionType && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
            {property.acquisitionType}
          </span>
        )}

        {/* Status de Ocupação */}
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
          {occupancy}
        </span>

        {/* Badge Contextual Opcional */}
        {contextBadge && (
          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 border border-amber-500 shadow-2xs ml-auto">
            {contextBadge}
          </span>
        )}
      </div>

      {/* Linha 2: Título e Endereço Completo */}
      <div>
        {contextTitle && (
          <h2 className="text-base sm:text-lg font-black text-white leading-tight mb-0.5">
            {contextTitle}
          </h2>
        )}
        <h3 className="text-sm font-extrabold text-slate-200 leading-snug">
          {propertyTitle}
        </h3>
        <p className="text-xs text-slate-300 flex items-center gap-1 mt-0.5">
          <MapPin className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
          <span>
            {cleanAddress} {neighborhood && !cleanAddress.includes(neighborhood) ? `— ${neighborhood}` : ''} ({city}/{state})
          </span>
        </p>
      </div>

      {/* Linha 3: Resumo Financeiro em Pílulas (se showKpis) */}
      {showKpis && (saleVal > 0 || appraisalVal > 0) && (
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
          {saleVal > 0 && (
            <div className="flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-lg border border-white/10">
              <span className="text-slate-300 text-[10px] uppercase font-bold">Lance Mín:</span>
              <span className="font-black text-orange-400">{formatCurrencyBRL(saleVal)}</span>
            </div>
          )}

          {appraisalVal > 0 && (
            <div className="flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-lg border border-white/10">
              <span className="text-slate-300 text-[10px] uppercase font-bold">Avaliação:</span>
              <span className="font-bold text-slate-200">{formatCurrencyBRL(appraisalVal)}</span>
            </div>
          )}

          {discountPct > 0 && (
            <div className="flex items-center gap-1 bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/30">
              <span className="text-emerald-300 text-[10px] uppercase font-bold">Desconto:</span>
              <span className="font-black text-emerald-400">{discountPct}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
