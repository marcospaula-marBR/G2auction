/**
 * Utilitário de Geração de URLs de Editais e Páginas Oficiais da Caixa Econômica Federal (CEF).
 * Diferencia com 100% de clareza o link da Página do Imóvel do link direto do Documento de Edital/Regulamento PDF.
 */

export function getCaixaPropertyPageUrl(property: any): string {
  if (!property) return 'https://venda-imoveis.caixa.gov.br/';

  if (property.source_url && property.source_url.includes('detalhe-imovel.asp')) {
    return property.source_url;
  }

  const rawId = property.source_property_id || property.code || property.id || '';
  const cleanId = String(rawId).replace(/\D/g, '');

  if (cleanId && cleanId.length >= 5) {
    return `https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnOrigem=index&hdnimovel=${cleanId}`;
  }

  return property.source_url || 'https://venda-imoveis.caixa.gov.br/';
}

export function getCaixaEditalUrl(property: any): string {
  if (!property) return 'https://venda-imoveis.caixa.gov.br/editais/';

  const rawEdital = property.editalUrl || property.edital_url || property.edital;

  // Se for uma URL direta de arquivo PDF ou endpoint específico de edital
  if (rawEdital && typeof rawEdital === 'string' && (rawEdital.endsWith('.pdf') || rawEdital.includes('download-edital') || rawEdital.includes('/editais/'))) {
    return rawEdital;
  }

  const rawId = property.source_property_id || property.code || property.id || '';
  const cleanId = String(rawId).replace(/\D/g, '');

  if (cleanId && cleanId.length >= 5) {
    // Endpoint de download direto de edital/documentos da Caixa Econômica Federal
    return `https://venda-imoveis.caixa.gov.br/sistema/download-edital.asp?hdnimovel=${cleanId}`;
  }

  return 'https://venda-imoveis.caixa.gov.br/editais/';
}

export function getCaixaEditaisCentralUrl(): string {
  return 'https://venda-imoveis.caixa.gov.br/editais/';
}
