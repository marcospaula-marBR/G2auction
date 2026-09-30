/**
 * Motor de Inteligência da Minha Jornada (G2 Journey Engine)
 * - Auto-diagnóstico de etapas
 * - Tabela de ITBI por município com STJ Tema 1113
 * - Estimador paramétrico de emolumentos de registro (SAEC/ONR)
 * - Central de certidões judiciais 100% gratuitas
 * - Consulta online de IPTU por município
 * - Consultor de Provisão de Condomínio por IA (% teto de avaliação)
 */

import { stripAccents } from './textUtils';

// 1. Tabela de Alíquotas de ITBI por Município
export const ITBI_MUNICIPAL_RATES: Record<string, { rate: number; name: string; notes?: string }> = {
  'SAO PAULO': { rate: 3.0, name: 'São Paulo/SP', notes: 'Alíquota padrão municipal: 3%' },
  'RIO DE JANEIRO': { rate: 3.0, name: 'Rio de Janeiro/RJ', notes: 'Alíquota padrão: 3%' },
  'BELO HORIZONTE': { rate: 3.0, name: 'Belo Horizonte/MG', notes: 'Alíquota padrão: 3%' },
  'CURITIBA': { rate: 2.7, name: 'Curitiba/PR', notes: 'Alíquota municipal: 2,7%' },
  'CAMPINAS': { rate: 2.7, name: 'Campinas/SP', notes: 'Alíquota municipal: 2,7%' },
  'SALVADOR': { rate: 3.0, name: 'Salvador/BA', notes: 'Alíquota municipal: 3%' },
  'PORTO ALEGRE': { rate: 3.0, name: 'Porto Alegre/RS', notes: 'Alíquota padrão: 3%' },
  'BRASILIA': { rate: 3.0, name: 'Brasília/DF', notes: 'ITBI/ITCD no DF: 3%' },
  'SANTOS': { rate: 2.5, name: 'Santos/SP', notes: 'Alíquota municipal: 2,5%' },
  'SANTO ANDRE': { rate: 2.0, name: 'Santo André/SP', notes: 'Alíquota reduzida: 2%' },
  'SAO BERNARDO DO CAMPO': { rate: 2.0, name: 'São Bernardo/SP', notes: 'Alíquota reduzida: 2%' },
  'SAO CAETANO DO SUL': { rate: 2.0, name: 'São Caetano/SP', notes: 'Alíquota municipal: 2%' },
  'GUARULHOS': { rate: 2.0, name: 'Guarulhos/SP', notes: 'Alíquota municipal: 2%' },
  'OSASCO': { rate: 2.0, name: 'Osasco/SP', notes: 'Alíquota municipal: 2%' },
  'RIBEIRAO PRETO': { rate: 2.0, name: 'Ribeirão Preto/SP', notes: 'Alíquota municipal: 2%' },
  'SOROCABA': { rate: 2.5, name: 'Sorocaba/SP', notes: 'Alíquota municipal: 2,5%' },
  'SAO JOSE DOS CAMPOS': { rate: 2.0, name: 'São José dos Campos/SP', notes: 'Alíquota municipal: 2%' },
  'JUNDIAI': { rate: 2.5, name: 'Jundiaí/SP', notes: 'Alíquota municipal: 2,5%' },
  'BARUERI': { rate: 2.0, name: 'Barueri/SP', notes: 'Alíquota municipal: 2%' },
  'PIRACICABA': { rate: 2.5, name: 'Piracicaba/SP', notes: 'Alíquota municipal: 2,5%' },
};

export function getItbiRateForCity(cityRaw: string = ''): { rate: number; isEstimated: boolean; cityDisplayName: string } {
  const normCity = stripAccents(cityRaw.toUpperCase().trim());
  if (ITBI_MUNICIPAL_RATES[normCity]) {
    return {
      rate: ITBI_MUNICIPAL_RATES[normCity].rate,
      isEstimated: false,
      cityDisplayName: ITBI_MUNICIPAL_RATES[normCity].name,
    };
  }
  // Fallback padrão Brasil
  return {
    rate: 2.5,
    isEstimated: true,
    cityDisplayName: cityRaw || 'Município',
  };
}

// 2. Links de Consulta Online de IPTU por Município
export function getIptuPortalLink(cityRaw: string = '', stateRaw: string = 'SP'): { url: string; portalName: string; isDirect: boolean } {
  const normCity = stripAccents(cityRaw.toUpperCase().trim());

  switch (normCity) {
    case 'SAO PAULO':
      return {
        url: 'https://duc.prefeitura.sp.gov.br/certidoes/forms_duc/frm_consulta_emissao_duc.aspx',
        portalName: 'DUC - Portal da Prefeitura de São Paulo (IPTU & Certidão Negativa)',
        isDirect: true,
      };
    case 'CAMPINAS':
      return {
        url: 'https://portal.campinas.sp.gov.br/servico/certidao-negativa-de-debitos-tributarios-imobiliarios',
        portalName: 'Prefeitura de Campinas (SEFIN - Certidão Negativa de Imóveis)',
        isDirect: true,
      };
    case 'SANTOS':
      return {
        url: 'https://egov.santos.sp.gov.br/tribweb/certidao_imobiliaria/',
        portalName: 'Prefeitura de Santos (Certidão Tributária Imobiliária)',
        isDirect: true,
      };
    case 'SANTO ANDRE':
      return {
        url: 'https://www.santoandre.sp.gov.br/servico/certidao-negativa-de-tributos-imobiliarios/',
        portalName: 'Prefeitura de Santo André (Portal Tributário)',
        isDirect: true,
      };
    case 'GUARULHOS':
      return {
        url: 'https://fazenda.guarulhos.sp.gov.br/certidao-negativa-de-debitos',
        portalName: 'Secretaria da Fazenda de Guarulhos',
        isDirect: true,
      };
    case 'RIO DE JANEIRO':
      return {
        url: 'https://carioca.rio/servicos/certidao-da-situacao-fiscal-e-enfitica-do-imovel/',
        portalName: 'Carioca Digital (Certidão de Situação Fiscal do Imóvel - RJ)',
        isDirect: true,
      };
    case 'CURITIBA':
      return {
        url: 'https://www.curitiba.pr.gov.br/servicos/certidao-negativa-de-tributos-municipais-imobiliaria/584',
        portalName: 'Prefeitura de Curitiba (Certidão Negativa Imobiliária)',
        isDirect: true,
      };
    case 'BELO HORIZONTE':
      return {
        url: 'https://servicos.pbh.gov.br/servico/certidao-de-debitos-de-tributos-municipais-imobiliarios',
        portalName: 'Prefeitura de Belo Horizonte (Certidão de Débitos Imobiliários)',
        isDirect: true,
      };
    default:
      return {
        url: `https://www.google.com/search?q=${encodeURIComponent(`consulta débitos iptu certidão negativa prefeitura de ${cityRaw} ${stateRaw}`)}`,
        portalName: `Pesquisa Oficial: Consulta IPTU Prefeitura de ${cityRaw}/${stateRaw}`,
        isDirect: false,
      };
  }
}

// 3. Central de Certidões 100% Gratuitas e Oficiais
export interface FreeCertificate {
  id: string;
  name: string;
  entity: string;
  cost: string;
  time: string;
  url: string;
  description: string;
  requiredFor: string;
}

export const FREE_CERTIFICATES: FreeCertificate[] = [
  {
    id: 'cndt',
    name: 'CNDT - Certidão Negativa de Débitos Trabalhistas',
    entity: 'Tribunal Superior do Trabalho (TST)',
    cost: '100% Gratuita',
    time: 'Imediata (Segundos)',
    url: 'https://www.tst.jus.br/certidao',
    description: 'Comprova se o devedor/proprietário anterior possui condenações ou execuções na Justiça do Trabalho que possam atingir o imóvel.',
    requiredFor: 'Due Diligence Jurídica contra Fraude à Execução',
  },
  {
    id: 'trf',
    name: 'Certidão de Distribuição Cível e Criminal Federal',
    entity: 'Justiça Federal (TRF)',
    cost: '100% Gratuita',
    time: 'Imediata (Online)',
    url: 'https://web.trf3.jus.br/certidao-regional/',
    description: 'Pesquisa ações fiscais da União, execuções e processos federais contra o réu/vendedor.',
    requiredFor: 'Verificação de execuções fiscais federais',
  },
  {
    id: 'pgfn',
    name: 'Certidão Conjunta de Tributos Federais e Dívida Ativa da União',
    entity: 'Receita Federal & PGFN',
    cost: '100% Gratuita',
    time: 'Imediata (Online)',
    url: 'https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir',
    description: 'Atesta regularidade perante a Receita Federal e débitos inscritos em dívida ativa da União.',
    requiredFor: 'Segurança contra penhoras fiscais',
  },
  {
    id: 'tjsp',
    name: 'Certidão de Falência, Recuperação e Distribuição Estadual',
    entity: 'Tribunal de Justiça Estadual (e-SAJ / PJe)',
    cost: 'Consulta Pública Gratuita',
    time: 'Instantâneo',
    url: 'https://esaj.tjsp.jus.br/cpopg/open.do',
    description: 'Consulta pública de processos em nome das partes envolvidas para checar embargos ou contestações.',
    requiredFor: 'Análise de litígios estaduais e embargos à arrematação',
  },
  {
    id: 'cnib',
    name: 'Central Nacional de Indisponibilidade de Bens (CNIB)',
    entity: 'ONR / CNJ',
    cost: 'Gratuito p/ Consulta',
    time: 'Online',
    url: 'https://www.indisponibilidade.org.br/',
    description: 'Verifica ordens judiciais de indisponibilidade decretadas sobre o CPF/CNPJ do executado.',
    requiredFor: 'Evitar surpresa com bloqueios e indisponibilidades judiciais',
  },
];

// 4. Estimativa de Emolumentos de Registro de Imóveis (Tabela Progressiva Estadual)
export function estimateRegistryFees(propertyValue: number, state: string = 'SP'): {
  estimatedCost: number;
  percentage: number;
  description: string;
} {
  const val = Math.max(propertyValue, 50000);

  // Faixas paramétricas da Tabela de Emolumentos de SP (TJSP / Lei 11.331/02)
  let cost = 1200;
  if (val <= 100000) {
    cost = 1400;
  } else if (val <= 200000) {
    cost = 2200;
  } else if (val <= 400000) {
    cost = 3400;
  } else if (val <= 600000) {
    cost = 4500;
  } else if (val <= 1000000) {
    cost = 5900;
  } else if (val <= 1500000) {
    cost = 7200;
  } else {
    cost = 8800; // Teto aproximado
  }

  const percentage = Number(((cost / val) * 100).toFixed(2));

  return {
    estimatedCost: cost,
    percentage,
    description: `Estimativa paramétrica da tabela de emolumentos cartorários para ${state}. O protocolo pode ser feito 100% online no SAEC/ONR.`,
  };
}

// 5. Consultor de Provisão de Débito de Condomínio por IA
export interface CondominiumDebtAdvice {
  hasCondominium: boolean;
  propertyCategory: 'apartment' | 'house_street' | 'house_condo' | 'commercial' | 'land';
  recommendedPercentage: number;
  suggestedAmount: number;
  rationale: string;
  presetOptions: Array<{ label: string; percentage: number; amount: number; description: string }>;
}

export function adviseCondominiumDebt(property: any): CondominiumDebtAdvice {
  const appraisalVal = Number(property.appraisal_value || property.appraisalValue || property.sale_value || 300000);
  const typeStr = stripAccents(String(property.property_type || property.propertyType || property.title || '').toUpperCase());

  const isHouse = typeStr.includes('CASA') || typeStr.includes('SOBRADO');
  const isCondoWord = typeStr.includes('CONDOMINIO') || typeStr.includes('CONDOMINIAL') || typeStr.includes('VILA');
  const isLand = typeStr.includes('TERRENO') || typeStr.includes('LOTE');
  const isCommercial = typeStr.includes('SALA') || typeStr.includes('COMERCIAL') || typeStr.includes('LOJA') || typeStr.includes('GALPAO');

  let category: CondominiumDebtAdvice['propertyCategory'] = 'apartment';
  let hasCondo = true;
  let recPct = 5.0; // 5% de provisão conservadora padrão

  if (isHouse && !isCondoWord) {
    category = 'house_street';
    hasCondo = false;
    recPct = 0;
  } else if (isHouse && isCondoWord) {
    category = 'house_condo';
    recPct = 3.5;
  } else if (isLand) {
    category = 'land';
    hasCondo = isCondoWord;
    recPct = isCondoWord ? 2.5 : 0;
  } else if (isCommercial) {
    category = 'commercial';
    recPct = 4.0;
  } else {
    // Apartamento padrão
    category = 'apartment';
    recPct = 5.0;
  }

  const suggestedAmount = Math.round((appraisalVal * recPct) / 100);

  let rationale = '';
  if (!hasCondo) {
    rationale = 'Imóvel classificado como casa ou imóvel individual de rua. Em regra, não há cobrança de taxa de condomínio. Provisão recomendada: R$ 0,00.';
  } else {
    rationale = `Para ${category === 'apartment' ? 'apartamentos' : 'imóveis em condomínio'} em leilão sem valor oficial informado, a IA recomenda provisionar ${recPct}% do valor de avaliação (cerca de R$ ${suggestedAmount.toLocaleString('pt-BR')}), o que cobre com folga de 12 a 24 meses de taxas condominiais em atraso caso o arrematante responda pelo débito.`;
  }

  const presetOptions = hasCondo
    ? [
        {
          label: 'Moderada (Recomendada IA)',
          percentage: recPct,
          amount: suggestedAmount,
          description: `${recPct}% da avaliação — Cobertura prudente para 12-18 meses de taxas.`,
        },
        {
          label: 'Conservadora (Teto Alto)',
          percentage: Math.min(recPct + 3, 10),
          amount: Math.round((appraisalVal * Math.min(recPct + 3, 10)) / 100),
          description: `${Math.min(recPct + 3, 10)}% da avaliação — Máxima segurança contra execuções antigas.`,
        },
        {
          label: 'Mínima / Baixo Risco',
          percentage: Math.max(recPct - 2.5, 1.5),
          amount: Math.round((appraisalVal * Math.max(recPct - 2.5, 1.5)) / 100),
          description: `${Math.max(recPct - 2.5, 1.5)}% da avaliação — Para imóveis com inadimplência recente.`,
        },
      ]
    : [
        {
          label: 'Sem Condomínio (Padrão)',
          percentage: 0,
          amount: 0,
          description: '0% — Imóvel não localizado em condomínio fechado.',
        },
        {
          label: 'Possui Associação/Condomínio',
          percentage: 2.5,
          amount: Math.round((appraisalVal * 2.5) / 100),
          description: '2,5% da avaliação — Caso faça parte de bolsão residencial ou associação de moradores.',
        },
      ];

  return {
    hasCondominium: hasCondo,
    propertyCategory: category,
    recommendedPercentage: recPct,
    suggestedAmount,
    rationale,
    presetOptions,
  };
}

// 6. Diagnóstico do Edital sobre Responsabilidade de Débitos (IPTU e Condomínio)
export interface EditalDebtResponsibility {
  bankName: 'CAIXA' | 'SANTANDER' | 'BRADESCO' | 'BANCO DO BRASIL' | 'JUDICIAL' | 'OUTROS';
  iptuPayer: 'BANCO' | 'ARREMATANTE' | 'SUB-ROGA' | 'INDEFINIDO';
  condoPayer: 'BANCO' | 'ARREMATANTE' | 'INDEFINIDO';
  highlightBadge: { text: string; color: string; bg: string; border: string };
  explanation: string;
}

export function detectEditalDebtRules(property: any): EditalDebtResponsibility {
  const bankRaw = stripAccents(String(property.bank || property.acquisitionType || property.source || '').toUpperCase());
  const descRaw = stripAccents(String(property.description || property.description_raw || '').toUpperCase());

  let bankName: EditalDebtResponsibility['bankName'] = 'OUTROS';
  if (bankRaw.includes('CAIXA') || descRaw.includes('CAIXA')) bankName = 'CAIXA';
  else if (bankRaw.includes('SANTANDER')) bankName = 'SANTANDER';
  else if (bankRaw.includes('BRADESCO')) bankName = 'BRADESCO';
  else if (bankRaw.includes('JUDICIAL') || descRaw.includes('JUDICIAL') || descRaw.includes('VARA CIVEL')) bankName = 'JUDICIAL';

  // Caixa Econômica: Em regra, a Caixa assume débitos de IPTU e condomínio até a data da arrematação
  if (bankName === 'CAIXA') {
    return {
      bankName: 'CAIXA',
      iptuPayer: 'BANCO',
      condoPayer: 'BANCO',
      highlightBadge: {
        text: '🟢 Caixa Quita IPTU e Condomínio até a Arrematação',
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
      },
      explanation: 'Nos leilões da Caixa Econômica Federal (1º/2º leilão, Licitação Aberta, Venda Online), o edital garante que os débitos de IPTU e condomínio vencidos até a data da arrematação são quitados pela Caixa.',
    };
  }

  // Judicial: IPTU sub-roga no preço (art. 130 CTN). Condomínio precisa ser verificado se edital ressalva
  if (bankName === 'JUDICIAL') {
    const hasArrematanteAssumeCondo = descRaw.includes('DEBITOS CONDOMINIAIS POR CONTA DO ARREMATANTE') || descRaw.includes('RESPONSABILIDADE DO ARREMATANTE');
    return {
      bankName: 'JUDICIAL',
      iptuPayer: 'SUB-ROGA',
      condoPayer: hasArrematanteAssumeCondo ? 'ARREMATANTE' : 'INDEFINIDO',
      highlightBadge: {
        text: '⚖️ Leilão Judicial: IPTU Sub-roga no Preço (Art. 130 CTN)',
        color: 'text-purple-700',
        bg: 'bg-purple-50',
        border: 'border-purple-200',
      },
      explanation: 'Pelo art. 130, parágrafo único do CTN, os débitos de IPTU sub-rogam-se sobre o valor depositado na arrematação. Para o condomínio, verifique se o edital expressamente transferiu a obrigação ao adquirente.',
    };
  }

  // Santander ou Bradesco:
  if (bankName === 'SANTANDER' || bankName === 'BRADESCO') {
    const hasBuyerPays = descRaw.includes('DEBITOS A CARGO DO COMPRADOR') || descRaw.includes('POR CONTA DO ADQUIRENTE');
    if (hasBuyerPays) {
      return {
        bankName,
        iptuPayer: 'ARREMATANTE',
        condoPayer: 'ARREMATANTE',
        highlightBadge: {
          text: '⚠️ Atenção: Débitos a Cargo do Arrematante',
          color: 'text-amber-700',
          bg: 'bg-amber-50',
          border: 'border-amber-200',
        },
        explanation: `O edital de leilão do ${bankName} indica que os débitos incidentes sobre o imóvel ficam a cargo do arrematante. Considere esses valores na sua viabilidade econômica.`,
      };
    }

    return {
      bankName,
      iptuPayer: 'BANCO',
      condoPayer: 'BANCO',
      highlightBadge: {
        text: `🟢 ${bankName}: Em regra, Banco Quita até a Arrematação`,
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
      },
      explanation: `Na maioria das ofertas do ${bankName}, o banco se responsabiliza pelos débitos de IPTU e condomínio até a data da expedição da ata/arrematação.`,
    };
  }

  return {
    bankName: 'OUTROS',
    iptuPayer: 'INDEFINIDO',
    condoPayer: 'INDEFINIDO',
    highlightBadge: {
      text: '📄 Verificar Cláusula de Débitos no Edital',
      color: 'text-slate-700',
      bg: 'bg-slate-100',
      border: 'border-slate-300',
    },
    explanation: 'Consulte a cláusula de encargos e débitos do edital oficial para verificar se ficam a cargo do comitente vendedor ou do arrematante.',
  };
}

// 7. Auto-Diagnóstico Completo de Etapas da Jornada
export function runJourneyAutoDiagnostic(property: any, currentStatuses: Record<number, string>): Record<number, string> {
  const nextStatuses = { ...currentStatuses };

  // Etapa 1: Pesquisa do Imóvel
  // Auto-completa se tem título, endereço e valores
  if (property.address?.city && (property.secondAuctionPrice || property.sale_value)) {
    if (!nextStatuses[1] || nextStatuses[1] === 'not_started') {
      nextStatuses[1] = 'completed';
    }
  }

  // Etapa 2: Coleta do Edital
  // Auto-completa se tem link de edital ou do leiloeiro/banco
  if (property.editalUrl || property.original_url || property.source_url || property.source_property_id) {
    if (!nextStatuses[2] || nextStatuses[2] === 'not_started') {
      nextStatuses[2] = 'completed';
    }
  }

  // Etapa 3: Análise do Edital
  // Se já possui descrição cadastrada e regras de financiamento / modalidade lidas
  if (property.description || property.description_raw) {
    if (!nextStatuses[3] || nextStatuses[3] === 'not_started') {
      nextStatuses[3] = 'completed';
    }
  }

  // Etapa 8: Posse e Ocupação
  // Se o status de ocupação já foi identificado pelo banco (ex: "Desocupado", "Ocupado")
  if (property.occupancyStatus || property.occupancy_status) {
    if (!nextStatuses[8] || nextStatuses[8] === 'not_started') {
      nextStatuses[8] = 'completed';
    }
  }

  return nextStatuses;
}
