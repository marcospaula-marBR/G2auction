/**
 * Utilitários de Normalização de Texto, Acentos e Cidades Brasileiras.
 */

export function stripAccents(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Normaliza o nome de uma cidade brasileira para exibição bonita (Capitalized).
 * Converte "SAO PAULO" -> "São Paulo", "CAMPINAS" -> "Campinas", "RIBEIRAO PRETO" -> "Ribeirão Preto".
 */
export function formatCityDisplayName(cityRaw: string | null | undefined): string {
  if (!cityRaw) return '';
  const clean = cityRaw.trim();
  if (!clean) return '';

  const normalizedKey = stripAccents(clean);

  // Mapeamento de Cidades Principais para acentuação bonita
  const BEAUTIFUL_CITIES_MAP: Record<string, string> = {
    'SAO PAULO': 'São Paulo',
    'RIBEIRAO PRETO': 'Ribeirão Preto',
    'SAO JOSE DO RIO PRETO': 'São José do Rio Preto',
    'SAO JOSE DOS CAMPOS': 'São José dos Campos',
    'SAO BERNARDO DO CAMPO': 'São Bernardo do Campo',
    'SANTO ANDRE': 'Santo André',
    'SAO CAETANO DO SUL': 'São Caetano do Sul',
    'SAO CARLOS': 'São Carlos',
    'JUNDIAI': 'Jundiaí',
    'MARILIA': 'Marília',
    'ARACATUBA': 'Araçatuba',
    'GUAKULHOS': 'Guarulhos',
    'RIO DE JANEIRO': 'Rio de Janeiro',
    'NITEROI': 'Niterói',
    'PETROPOLIS': 'Petrópolis',
    'DUQUE DE CAXIAS': 'Duque de Caxias',
    'NOVA IGUACU': 'Nova Iguaçu',
    'BELO HORIZONTE': 'Belo Horizonte',
    'UBERLANDIA': 'Uberlândia',
    'JUIZ DE FORA': 'Juiz de Fora',
    'POCOS DE CALDAS': 'Poços de Caldas',
    'BRASILIA': 'Brasília',
    'AGUAS CLARAS': 'Águas Claras',
    'CURITIBA': 'Curitiba',
    'MARINGA': 'Maringá',
    'FOZ DO IGUACU': 'Foz do Iguaçu',
    'FLORIANOPOLIS': 'Florianópolis',
    'JOINVILLE': 'Joinville',
    'CHAPECO': 'Chapecó',
    'CRICIUMA': 'Criciúma',
    'BALNEARIO CAMBORIU': 'Balneário Camboriú',
    'PORTO ALEGRE': 'Porto Alegre',
    'CAXIAS DO SUL': 'Caxias do Sul',
    'PELOTAS': 'Pelotas',
    'GRAVATAI': 'Gravataí',
    'NOVO HAMBURGO': 'Novo Hamburgo',
    'SALVADOR': 'Salvador',
    'FEIRA DE SANTANA': 'Feira de Santana',
    'VITORIA DA CONQUISTA': 'Vitória da Conquista',
    'ITABUNA': 'Itabuna',
  };

  if (BEAUTIFUL_CITIES_MAP[normalizedKey]) {
    return BEAUTIFUL_CITIES_MAP[normalizedKey];
  }

  // Capitalização padrão para cidades genéricas (ex: "AGUAS DE LINDOIA" -> "Aguas De Lindoia")
  return clean
    .toLowerCase()
    .split(' ')
    .map((word) => {
      if (['de', 'da', 'do', 'das', 'dos', 'e'].includes(word) && word.length <= 3) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
