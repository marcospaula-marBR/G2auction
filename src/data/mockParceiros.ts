import type { Partner } from '../types/auction';

export const mockParceiros: Partner[] = [
  {
    id: 'part-1',
    name: 'Dra. Gabriela Vasconcelos',
    role: 'Advogado Especialista',
    city: 'Campinas',
    state: 'SP',
    rating: 4.9,
    completedJobsCount: 84,
    onTimeRate: 98,
    trustScore: 97,
    phone: '(19) 99842-1102',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
    specialty: 'Direito Imobiliário, Análise de Editais e Imissão na Posse / Desocupação Ágil'
  },
  {
    id: 'part-2',
    name: 'Eng. Ricardo Silveira',
    role: 'Mestre de Obras / Empreiteiro',
    city: 'Campinas',
    state: 'SP',
    rating: 4.8,
    completedJobsCount: 42,
    onTimeRate: 95,
    trustScore: 94,
    phone: '(19) 98122-4490',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80',
    specialty: 'Reforma Express para Flipping, Pintura, Elétrica e Hidráulica Comercial/Residencial'
  },
  {
    id: 'part-3',
    name: 'Carlos Alberto Mendes',
    role: 'Despachante Imobiliário',
    city: 'São Paulo',
    state: 'SP',
    rating: 5.0,
    completedJobsCount: 156,
    onTimeRate: 100,
    trustScore: 99,
    phone: '(11) 97651-3300',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
    specialty: 'Registro de Carta de Arrematação em Cartório de Imóveis e Quitação de ITBI'
  },
  {
    id: 'part-4',
    name: 'Mariana Prado Correia',
    role: 'Corretor de Imóveis',
    city: 'Santos',
    state: 'SP',
    rating: 4.9,
    completedJobsCount: 68,
    onTimeRate: 96,
    trustScore: 95,
    phone: '(13) 99104-8822',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
    specialty: 'Venda Rápida de Imóveis Arrematados e Gestão de Locação por Temporada'
  }
];
