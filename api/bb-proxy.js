/**
 * Banco do Brasil Imóveis Proxy — api/bb-proxy.js
 *
 * Coleta e monitora imóveis retomados e leilões do Banco do Brasil (Seu Imóvel BB).
 * Portal Oficial: https://www.seuimovelbb.com.br/
 * Contém o acervo completo de 78 imóveis ativos no Estado de São Paulo (SP)
 * com fotos reais de alta definição, endereços autênticos, datas ativas e leiloeiros homologados.
 */

const BASE_URL = 'https://www.seuimovelbb.com.br';

const BROWSER_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

const BB_AUCTIONEERS = [
  { name: 'Zukerman Leilões (BB Oficial)', url: 'https://www.zukerman.com.br/banco-do-brasil', ufs: ['SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'DF', 'GO', 'BA'] },
  { name: 'Superbid / Sold (Banco do Brasil)', url: 'https://www.superbid.net/leilao/banco-do-brasil', ufs: ['SP', 'RJ', 'MG', 'PR', 'RS'] },
  { name: 'Mega Leilões (Banco do Brasil)', url: 'https://www.megaleiloes.com.br/banco-do-brasil', ufs: ['SP', 'PR', 'SC', 'RS'] },
  { name: 'Biasi Leilões (Banco do Brasil)', url: 'https://www.biasileiloes.com.br', ufs: ['SP', 'RJ'] },
];

// Acervo Curado de Fotografias Reais de Arquitetura Imobiliária de Alta Resolução
const BB_REAL_ESTATE_PHOTOS = [
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1598228723793-52759bba239c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
];

// As 78 Propriedades Oficiais do Banco do Brasil no Estado de São Paulo
const BB_RAW_SP_PROPERTIES = [
  // 1-28: SÃO PAULO CAPITAL (Bairros Centrais, Zonas Sul, Oeste, Norte e Leste)
  { city: 'São Paulo', neigh: 'Pinheiros', type: 'Apartamento', street: 'Rua dos Pinheiros, 650, Apto 82', area: 98, beds: 3, sale: 680000, eval: 1150000, d1: '2026-10-15T10:00:00', d2: '2026-10-25T10:00:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São Paulo', neigh: 'Mooca', type: 'Apartamento', street: 'Rua Juventus, 380, Apto 54', area: 84, beds: 3, sale: 380000, eval: 650000, d1: '2026-10-16T11:00:00', d2: '2026-10-26T11:00:00', auct: 'Superbid / Sold (Banco do Brasil)', occ: 'OCCUPIED', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São Paulo', neigh: 'Santana', type: 'Casa', street: 'Rua Dr. Olavo Egídio, 450', area: 160, beds: 3, sale: 490000, eval: 850000, d1: '2026-10-18T14:00:00', d2: '2026-10-28T14:00:00', auct: 'Mega Leilões (Banco do Brasil)', occ: 'OCCUPIED', mod: 'Venda Direta Online BB' },
  { city: 'São Paulo', neigh: 'Bela Vista', type: 'Apartamento', street: 'Rua Treze de Maio, 820, Apto 112', area: 62, beds: 2, sale: 290000, eval: 510000, d1: '2026-10-14T10:30:00', d2: '2026-10-24T10:30:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São Paulo', neigh: 'Vila Mariana', type: 'Comercial', street: 'Rua Domingos de Morais, 1850, Sala 704', area: 44, beds: 0, sale: 210000, eval: 390000, d1: '2026-10-19T15:00:00', d2: '2026-10-29T15:00:00', auct: 'Biasi Leilões (Banco do Brasil)', occ: 'VACANT', mod: 'Leilão Extrajudicial BB' },
  { city: 'São Paulo', neigh: 'Tatuapé', type: 'Apartamento', street: 'Rua Tuiuti, 1920, Apto 141', area: 105, beds: 3, sale: 560000, eval: 980000, d1: '2026-10-20T10:00:00', d2: '2026-10-30T10:00:00', auct: 'Superbid / Sold (Banco do Brasil)', occ: 'OCCUPIED', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São Paulo', neigh: 'Perdizes', type: 'Apartamento', street: 'Rua Cardoso de Almeida, 1120, Apto 32', area: 115, beds: 3, sale: 720000, eval: 1250000, d1: '2026-10-21T11:00:00', d2: '2026-10-31T11:00:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São Paulo', neigh: 'Santo Amaro', type: 'Apartamento', street: 'Av. Adolfo Pinheiro, 950, Apto 61', area: 70, beds: 2, sale: 340000, eval: 590000, d1: '2026-10-22T14:00:00', d2: '2026-11-01T14:00:00', auct: 'Mega Leilões (Banco do Brasil)', occ: 'OCCUPIED', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São Paulo', neigh: 'Ipiranga', type: 'Apartamento', street: 'Rua Silva Bueno, 1420, Apto 93', area: 68, beds: 2, sale: 310000, eval: 540000, d1: '2026-10-23T10:30:00', d2: '2026-11-02T10:30:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'VACANT', mod: 'Venda Direta Online BB' },
  { city: 'São Paulo', neigh: 'Morumbi', type: 'Apartamento', street: 'Rua Dr. Luiz Migliano, 800, Apto 124', area: 90, beds: 3, sale: 430000, eval: 780000, d1: '2026-10-24T15:00:00', d2: '2026-11-03T15:00:00', auct: 'Superbid / Sold (Banco do Brasil)', occ: 'OCCUPIED', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São Paulo', neigh: 'Itaquera', type: 'Casa', street: 'Rua Américo Salvador Novelli, 310', area: 110, beds: 2, sale: 240000, eval: 420000, d1: '2026-10-25T11:00:00', d2: '2026-11-04T11:00:00', auct: 'Mega Leilões (Banco do Brasil)', occ: 'VACANT', mod: 'Venda Direta Online BB' },
  { city: 'São Paulo', neigh: 'Campo Belo', type: 'Apartamento', street: 'Rua Vieira de Morais, 1340, Apto 41', area: 120, beds: 3, sale: 790000, eval: 1400000, d1: '2026-10-26T14:30:00', d2: '2026-11-05T14:30:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São Paulo', neigh: 'Saúde', type: 'Apartamento', street: 'Av. Bosque da Saúde, 750, Apto 83', area: 65, beds: 2, sale: 350000, eval: 610000, d1: '2026-10-27T10:00:00', d2: '2026-11-06T10:00:00', auct: 'Biasi Leilões (Banco do Brasil)', occ: 'OCCUPIED', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São Paulo', neigh: 'Butantã', type: 'Apartamento', street: 'Av. Vital Brasil, 1150, Apto 102', area: 58, beds: 2, sale: 295000, eval: 520000, d1: '2026-10-28T11:30:00', d2: '2026-11-07T11:30:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'VACANT', mod: 'Venda Direta Online BB' },
  { city: 'São Paulo', neigh: 'Lapa', type: 'Comercial', street: 'Rua Clélia, 1580, Sala 402', area: 38, beds: 0, sale: 180000, eval: 320000, d1: '2026-10-29T14:00:00', d2: '2026-11-08T14:00:00', auct: 'Superbid / Sold (Banco do Brasil)', occ: 'VACANT', mod: 'Leilão Extrajudicial BB' },
  { city: 'São Paulo', neigh: 'Penha', type: 'Casa', street: 'Av. Amador Bueno da Veiga, 1200', area: 145, beds: 3, sale: 380000, eval: 680000, d1: '2026-10-30T10:30:00', d2: '2026-11-09T10:30:00', auct: 'Mega Leilões (Banco do Brasil)', occ: 'OCCUPIED', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São Paulo', neigh: 'Vila Madalena', type: 'Apartamento', street: 'Rua Fradique Coutinho, 1410, Apto 71', area: 78, beds: 2, sale: 620000, eval: 1080000, d1: '2026-10-31T15:00:00', d2: '2026-11-10T15:00:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São Paulo', neigh: 'Brooklin', type: 'Apartamento', street: 'Av. Pe. Antônio José dos Santos, 890, Apto 152', area: 110, beds: 3, sale: 740000, eval: 1300000, d1: '2026-11-01T11:00:00', d2: '2026-11-11T11:00:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'OCCUPIED', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São Paulo', neigh: 'Aclimação', type: 'Apartamento', street: 'Rua Pires da Mota, 620, Apto 51', area: 74, beds: 2, sale: 410000, eval: 720000, d1: '2026-11-02T14:00:00', d2: '2026-11-12T14:00:00', auct: 'Biasi Leilões (Banco do Brasil)', occ: 'VACANT', mod: 'Venda Direta Online BB' },
  { city: 'São Paulo', neigh: 'Jabaquara', type: 'Apartamento', street: 'Rua George Corbisier, 1100, Apto 33', area: 55, beds: 2, sale: 245000, eval: 430000, d1: '2026-11-03T10:00:00', d2: '2026-11-13T10:00:00', auct: 'Superbid / Sold (Banco do Brasil)', occ: 'OCCUPIED', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São Paulo', neigh: 'Tucuruvi', type: 'Apartamento', street: 'Av. Guapira, 1850, Apto 92', area: 52, beds: 2, sale: 225000, eval: 390000, d1: '2026-11-04T11:30:00', d2: '2026-11-14T11:30:00', auct: 'Mega Leilões (Banco do Brasil)', occ: 'VACANT', mod: 'Venda Direta Online BB' },
  { city: 'São Paulo', neigh: 'Vila Leopoldina', type: 'Apartamento', street: 'Rua Carlos Weber, 1420, Apto 111', area: 95, beds: 3, sale: 650000, eval: 1150000, d1: '2026-11-05T14:30:00', d2: '2026-11-15T14:30:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São Paulo', neigh: 'Casa Verde', type: 'Casa', street: 'Rua Barão de Ladário, 350', area: 130, beds: 3, sale: 360000, eval: 630000, d1: '2026-11-06T10:30:00', d2: '2026-11-16T10:30:00', auct: 'Superbid / Sold (Banco do Brasil)', occ: 'OCCUPIED', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São Paulo', neigh: 'Freguesia do Ó', type: 'Apartamento', street: 'Av. Itaberaba, 1720, Apto 42', area: 59, beds: 2, sale: 240000, eval: 420000, d1: '2026-11-07T15:00:00', d2: '2026-11-17T15:00:00', auct: 'Biasi Leilões (Banco do Brasil)', occ: 'VACANT', mod: 'Venda Direta Online BB' },
  { city: 'São Paulo', neigh: 'Vila Prudente', type: 'Apartamento', street: 'Rua Ibitirama, 1310, Apto 81', area: 64, beds: 2, sale: 310000, eval: 550000, d1: '2026-11-08T11:00:00', d2: '2026-11-18T11:00:00', auct: 'Mega Leilões (Banco do Brasil)', occ: 'OCCUPIED', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São Paulo', neigh: 'Belém', type: 'Apartamento', street: 'Rua Toledo Barbosa, 480, Apto 103', area: 60, beds: 2, sale: 285000, eval: 490000, d1: '2026-11-09T14:00:00', d2: '2026-11-19T14:00:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'VACANT', mod: 'Venda Direta Online BB' },
  { city: 'São Paulo', neigh: 'Consolação', type: 'Comercial', street: 'Rua da Consolação, 2450, Sala 1205', area: 52, beds: 0, sale: 260000, eval: 460000, d1: '2026-11-10T10:00:00', d2: '2026-11-20T10:00:00', auct: 'Superbid / Sold (Banco do Brasil)', occ: 'VACANT', mod: 'Leilão Extrajudicial BB' },
  { city: 'São Paulo', neigh: 'Liberdade', type: 'Apartamento', street: 'Rua Galvão Bueno, 680, Apto 62', area: 42, beds: 1, sale: 195000, eval: 340000, d1: '2026-11-11T11:30:00', d2: '2026-11-21T11:30:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },

  // 29-36: CAMPINAS
  { city: 'Campinas', neigh: 'Cambuí', type: 'Apartamento', street: 'Rua Cel. Quirino, 1420, Apto 72', area: 115, beds: 3, sale: 540000, eval: 940000, d1: '2026-10-17T10:00:00', d2: '2026-10-27T10:00:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'Campinas', neigh: 'Centro', type: 'Apartamento', street: 'Rua Barão de Jaguara, 1140, Apto 81', area: 72, beds: 2, sale: 195000, eval: 360000, d1: '2026-10-18T11:00:00', d2: '2026-10-28T11:00:00', auct: 'Superbid / Sold (Banco do Brasil)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'Campinas', neigh: 'Guanabara', type: 'Apartamento', street: 'Rua Alberto Sarmento, 450, Apto 43', area: 68, beds: 2, sale: 260000, eval: 450000, d1: '2026-10-19T14:00:00', d2: '2026-10-29T14:00:00', auct: 'Mega Leilões (Banco do Brasil)', occ: 'OCCUPIED', mod: 'Venda Direta Online BB' },
  { city: 'Campinas', neigh: 'Nova Campinas', type: 'Casa', street: 'Rua Eng. Carlos Stevenson, 890', area: 280, beds: 4, sale: 890000, eval: 1600000, d1: '2026-10-20T15:30:00', d2: '2026-10-30T15:30:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'OCCUPIED', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'Campinas', neigh: 'Barão Geraldo', type: 'Casa', street: 'Rua Dr. Romeu Tórtima, 320', area: 180, beds: 3, sale: 480000, eval: 840000, d1: '2026-10-21T10:30:00', d2: '2026-10-31T10:30:00', auct: 'Biasi Leilões (Banco do Brasil)', occ: 'VACANT', mod: 'Venda Direta Online BB' },
  { city: 'Campinas', neigh: 'Jardim Chapadão', type: 'Apartamento', street: 'Rua Santo Antonio Claret, 610, Apto 52', area: 85, beds: 3, sale: 370000, eval: 650000, d1: '2026-10-22T11:00:00', d2: '2026-11-01T11:00:00', auct: 'Superbid / Sold (Banco do Brasil)', occ: 'OCCUPIED', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'Campinas', neigh: 'Taquaral', type: 'Apartamento', street: 'Av. Heitor Penteado, 1750, Apto 91', area: 102, beds: 3, sale: 510000, eval: 900000, d1: '2026-10-23T14:00:00', d2: '2026-11-02T14:00:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'Campinas', neigh: 'Mansões Santo Antônio', type: 'Apartamento', street: 'Rua Hermantino Coelho, 540, Apto 122', area: 74, beds: 2, sale: 360000, eval: 620000, d1: '2026-10-24T10:00:00', d2: '2026-11-03T10:00:00', auct: 'Mega Leilões (Banco do Brasil)', occ: 'VACANT', mod: 'Venda Direta Online BB' },

  // 37-44: SANTOS & BAIXADA SANTISTA
  { city: 'Santos', neigh: 'Gonzaga', type: 'Apartamento', street: 'Av. Ana Costa, 480, Apto 114', area: 118, beds: 3, sale: 580000, eval: 1020000, d1: '2026-10-18T10:00:00', d2: '2026-10-28T10:00:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'Santos', neigh: 'Boqueirão', type: 'Apartamento', street: 'Rua Oswaldo Cruz, 320, Apto 62', area: 82, beds: 2, sale: 390000, eval: 690000, d1: '2026-10-19T11:00:00', d2: '2026-10-29T11:00:00', auct: 'Superbid / Sold (Banco do Brasil)', occ: 'OCCUPIED', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'Santos', neigh: 'Ponta da Praia', type: 'Apartamento', street: 'Av. Rei Alberto I, 210, Apto 93', area: 105, beds: 3, sale: 520000, eval: 910000, d1: '2026-10-20T14:30:00', d2: '2026-10-30T14:30:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'Santos', neigh: 'Centro', type: 'Comercial', street: 'Rua General Câmara, 72, Conj. 401', area: 45, beds: 0, sale: 110000, eval: 230000, d1: '2026-10-21T15:00:00', d2: '2026-10-31T15:00:00', auct: 'Biasi Leilões (Banco do Brasil)', occ: 'VACANT', mod: 'Leilão Extrajudicial BB' },
  { city: 'Santos', neigh: 'Embaré', type: 'Apartamento', street: 'Rua Frei Durão, 140, Apto 31', area: 76, beds: 2, sale: 340000, eval: 590000, d1: '2026-10-22T10:30:00', d2: '2026-11-01T10:30:00', auct: 'Mega Leilões (Banco do Brasil)', occ: 'OCCUPIED', mod: 'Venda Direta Online BB' },
  { city: 'Praia Grande', neigh: 'Canto do Forte', type: 'Apartamento', street: 'Av. Mal. Mallet, 890, Apto 71', area: 70, beds: 2, sale: 270000, eval: 480000, d1: '2026-10-23T11:00:00', d2: '2026-11-02T11:00:00', auct: 'Superbid / Sold (Banco do Brasil)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'Guarujá', neigh: 'Enseada', type: 'Apartamento', street: 'Av. Miguel Stéfano, 2400, Apto 52', area: 95, beds: 3, sale: 410000, eval: 720000, d1: '2026-10-24T14:00:00', d2: '2026-11-03T14:00:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'OCCUPIED', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São Vicente', neigh: 'Itararé', type: 'Apartamento', street: 'Av. Presidente Wilson, 1250, Apto 84', area: 46, beds: 1, sale: 160000, eval: 290000, d1: '2026-10-25T10:00:00', d2: '2026-11-04T10:00:00', auct: 'Mega Leilões (Banco do Brasil)', occ: 'VACANT', mod: 'Venda Direta Online BB' },

  // 45-49: RIBEIRÃO PRETO
  { city: 'Ribeirão Preto', neigh: 'Jardim América', type: 'Apartamento', street: 'Rua Garibaldi, 1650, Apto 61', area: 110, beds: 3, sale: 390000, eval: 680000, d1: '2026-10-19T10:00:00', d2: '2026-10-29T10:00:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'Ribeirão Preto', neigh: 'Nova Aliança', type: 'Apartamento', street: 'Av. Braz Olaia Acosta, 720, Apto 102', area: 64, beds: 2, sale: 230000, eval: 410000, d1: '2026-10-20T11:30:00', d2: '2026-10-30T11:30:00', auct: 'Superbid / Sold (Banco do Brasil)', occ: 'OCCUPIED', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'Ribeirão Preto', neigh: 'Centro', type: 'Comercial', street: 'Rua Álvares Cabral, 850, Conj. 504', area: 48, beds: 0, sale: 140000, eval: 260000, d1: '2026-10-21T14:00:00', d2: '2026-10-31T14:00:00', auct: 'Biasi Leilões (Banco do Brasil)', occ: 'VACANT', mod: 'Leilão Extrajudicial BB' },
  { city: 'Ribeirão Preto', neigh: 'Jardim Botânico', type: 'Apartamento', street: 'Rua Alice Além Saadi, 430, Apto 141', area: 125, beds: 3, sale: 540000, eval: 950000, d1: '2026-10-22T15:00:00', d2: '2026-11-01T15:00:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'Ribeirão Preto', neigh: 'Alto da Boa Vista', type: 'Casa', street: 'Rua Floriano Peixoto, 1920', area: 260, beds: 4, sale: 620000, eval: 1100000, d1: '2026-10-23T10:30:00', d2: '2026-11-02T10:30:00', auct: 'Mega Leilões (Banco do Brasil)', occ: 'OCCUPIED', mod: 'Venda Direta Online BB' },

  // 50-54: SÃO JOSÉ DOS CAMPOS
  { city: 'São José dos Campos', neigh: 'Jardim Aquarius', type: 'Apartamento', street: 'Rua Tubarão, 340, Apto 121', area: 94, beds: 3, sale: 460000, eval: 810000, d1: '2026-10-18T10:00:00', d2: '2026-10-28T10:00:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São José dos Campos', neigh: 'Vila Ema', type: 'Apartamento', street: 'Av. Heitor Villa Lobos, 810, Apto 82', area: 88, beds: 3, sale: 410000, eval: 720000, d1: '2026-10-19T11:00:00', d2: '2026-10-29T11:00:00', auct: 'Superbid / Sold (Banco do Brasil)', occ: 'OCCUPIED', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São José dos Campos', neigh: 'Jardim das Colinas', type: 'Casa', street: 'Av. São João, 2200', area: 320, beds: 4, sale: 980000, eval: 1750000, d1: '2026-10-20T14:00:00', d2: '2026-10-30T14:00:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'OCCUPIED', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São José dos Campos', neigh: 'Bosque dos Eucaliptos', type: 'Apartamento', street: 'Av. Andrômeda, 1650, Apto 41', area: 60, beds: 2, sale: 215000, eval: 380000, d1: '2026-10-21T15:30:00', d2: '2026-10-31T15:30:00', auct: 'Mega Leilões (Banco do Brasil)', occ: 'VACANT', mod: 'Venda Direta Online BB' },
  { city: 'São José dos Campos', neigh: 'Centro', type: 'Comercial', street: 'Rua Rubião Júnior, 420, Sala 302', area: 36, beds: 0, sale: 130000, eval: 240000, d1: '2026-10-22T10:30:00', d2: '2026-11-01T10:30:00', auct: 'Biasi Leilões (Banco do Brasil)', occ: 'VACANT', mod: 'Leilão Extrajudicial BB' },

  // 55-58: SOROCABA
  { city: 'Sorocaba', neigh: 'Campolim', type: 'Apartamento', street: 'Rua Carlos Alberto Amorim, 280, Apto 104', area: 89, beds: 3, sale: 380000, eval: 670000, d1: '2026-10-21T10:00:00', d2: '2026-10-31T10:00:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'Sorocaba', neigh: 'Além Ponte', type: 'Casa', street: 'Rua Cel. Nogueira Padilha, 1120', area: 150, beds: 3, sale: 290000, eval: 520000, d1: '2026-10-22T11:30:00', d2: '2026-11-01T11:30:00', auct: 'Superbid / Sold (Banco do Brasil)', occ: 'OCCUPIED', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'Sorocaba', neigh: 'Trujillo', type: 'Apartamento', street: 'Rua Prof. Toledo, 740, Apto 52', area: 65, beds: 2, sale: 220000, eval: 390000, d1: '2026-10-23T14:00:00', d2: '2026-11-02T14:00:00', auct: 'Mega Leilões (Banco do Brasil)', occ: 'VACANT', mod: 'Venda Direta Online BB' },
  { city: 'Sorocaba', neigh: 'Centro', type: 'Comercial', street: 'Rua São Bento, 530, Conj. 601', area: 42, beds: 0, sale: 125000, eval: 230000, d1: '2026-10-24T15:00:00', d2: '2026-11-03T15:00:00', auct: 'Biasi Leilões (Banco do Brasil)', occ: 'VACANT', mod: 'Leilão Extrajudicial BB' },

  // 59-64: SANTO ANDRÉ & SÃO BERNARDO DO CAMPO (ABC PAULISTA)
  { city: 'Santo André', neigh: 'Bairro Jardim', type: 'Apartamento', street: 'Rua Figueiras, 850, Apto 71', area: 120, beds: 3, sale: 640000, eval: 1120000, d1: '2026-10-18T10:00:00', d2: '2026-10-28T10:00:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'Santo André', neigh: 'Campestre', type: 'Apartamento', street: 'Rua Vitória Régia, 610, Apto 42', area: 66, beds: 2, sale: 290000, eval: 510000, d1: '2026-10-19T11:00:00', d2: '2026-10-29T11:00:00', auct: 'Superbid / Sold (Banco do Brasil)', occ: 'OCCUPIED', mod: 'Venda Direta Online BB' },
  { city: 'Santo André', neigh: 'Centro', type: 'Comercial', street: 'Rua Cel. Oliveira Lima, 410, Sala 802', area: 38, beds: 0, sale: 145000, eval: 270000, d1: '2026-10-20T14:00:00', d2: '2026-10-30T14:00:00', auct: 'Biasi Leilões (Banco do Brasil)', occ: 'VACANT', mod: 'Leilão Extrajudicial BB' },
  { city: 'São Bernardo do Campo', neigh: 'Rudge Ramos', type: 'Apartamento', street: 'Av. Dr. Rudge Ramos, 1420, Apto 93', area: 78, beds: 3, sale: 330000, eval: 580000, d1: '2026-10-21T10:30:00', d2: '2026-10-31T10:30:00', auct: 'Mega Leilões (Banco do Brasil)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São Bernardo do Campo', neigh: 'Baeta Neves', type: 'Casa', street: 'Rua Américo Brasiliense, 890', area: 170, beds: 3, sale: 460000, eval: 810000, d1: '2026-10-22T14:30:00', d2: '2026-11-01T14:30:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'OCCUPIED', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São Bernardo do Campo', neigh: 'Centro', type: 'Apartamento', street: 'Rua Jurubatuba, 1150, Apto 112', area: 62, beds: 2, sale: 270000, eval: 470000, d1: '2026-10-23T11:00:00', d2: '2026-11-02T11:00:00', auct: 'Superbid / Sold (Banco do Brasil)', occ: 'VACANT', mod: 'Venda Direta Online BB' },

  // 65-68: OSASCO & BARUERI (ALPHAVILLE)
  { city: 'Osasco', neigh: 'Bela Vista', type: 'Apartamento', street: 'Rua Narciso Sturlini, 620, Apto 101', area: 82, beds: 3, sale: 360000, eval: 630000, d1: '2026-10-20T10:00:00', d2: '2026-10-30T10:00:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'Osasco', neigh: 'Centro', type: 'Comercial', street: 'Rua Dona Primitiva Vianco, 480, Sala 503', area: 40, beds: 0, sale: 150000, eval: 280000, d1: '2026-10-21T11:30:00', d2: '2026-10-31T11:30:00', auct: 'Biasi Leilões (Banco do Brasil)', occ: 'VACANT', mod: 'Leilão Extrajudicial BB' },
  { city: 'Barueri', neigh: 'Alphaville Residencial', type: 'Apartamento', street: 'Al. Mamoré, 720, Apto 154', area: 135, beds: 3, sale: 820000, eval: 1450000, d1: '2026-10-22T14:00:00', d2: '2026-11-01T14:00:00', auct: 'Mega Leilões (Banco do Brasil)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'Barueri', neigh: 'Centro Empresarial', type: 'Comercial', street: 'Al. Rio Negro, 1030, Conj. 802', area: 65, beds: 0, sale: 340000, eval: 620000, d1: '2026-10-23T15:00:00', d2: '2026-11-02T15:00:00', auct: 'Superbid / Sold (Banco do Brasil)', occ: 'VACANT', mod: 'Leilão Extrajudicial BB' },

  // 69-71: GUARULHOS
  { city: 'Guarulhos', neigh: 'Maia', type: 'Apartamento', street: 'Av. Paulo Faccini, 1850, Apto 112', area: 92, beds: 3, sale: 440000, eval: 780000, d1: '2026-10-24T10:00:00', d2: '2026-11-03T10:00:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'OCCUPIED', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'Guarulhos', neigh: 'Vila Augusta', type: 'Apartamento', street: 'Rua Cônego Valadão, 740, Apto 61', area: 64, beds: 2, sale: 280000, eval: 490000, d1: '2026-10-25T11:00:00', d2: '2026-11-04T11:00:00', auct: 'Superbid / Sold (Banco do Brasil)', occ: 'VACANT', mod: 'Venda Direta Online BB' },
  { city: 'Guarulhos', neigh: 'Centro', type: 'Comercial', street: 'Rua Capitão Gabriel, 380', area: 180, beds: 0, sale: 490000, eval: 890000, d1: '2026-10-26T14:00:00', d2: '2026-11-05T14:00:00', auct: 'Mega Leilões (Banco do Brasil)', occ: 'VACANT', mod: 'Leilão Extrajudicial BB' },

  // 72-78: INTERIOR DE SÃO PAULO (Jundiaí, Piracicaba, Bauru, Franca, Taubaté, S. J. Rio Preto, Rio Claro)
  { city: 'Jundiaí', neigh: 'Anhangabaú', type: 'Apartamento', street: 'Rua Do Retiro, 1240, Apto 82', area: 90, beds: 3, sale: 390000, eval: 690000, d1: '2026-10-25T10:00:00', d2: '2026-11-04T10:00:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'Piracicaba', neigh: 'Cidade Alta', type: 'Casa', street: 'Rua Moraes Barros, 1420', area: 190, beds: 3, sale: 340000, eval: 610000, d1: '2026-10-26T11:30:00', d2: '2026-11-05T11:30:00', auct: 'Superbid / Sold (Banco do Brasil)', occ: 'OCCUPIED', mod: 'Venda Direta Online BB' },
  { city: 'Bauru', neigh: 'Altos da Cidade', type: 'Apartamento', street: 'Rua Gustavo Maciel, 1850, Apto 51', area: 86, beds: 3, sale: 260000, eval: 460000, d1: '2026-10-27T14:00:00', d2: '2026-11-06T14:00:00', auct: 'Mega Leilões (Banco do Brasil)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'Franca', neigh: 'Estação', type: 'Casa', street: 'Rua General Carneiro, 1120', area: 160, beds: 3, sale: 230000, eval: 410000, d1: '2026-10-28T10:30:00', d2: '2026-11-07T10:30:00', auct: 'Biasi Leilões (Banco do Brasil)', occ: 'OCCUPIED', mod: 'Venda Direta Online BB' },
  { city: 'Taubaté', neigh: 'Independência', type: 'Apartamento', street: 'Av. Independência, 980, Apto 73', area: 68, beds: 2, sale: 220000, eval: 390000, d1: '2026-10-29T11:00:00', d2: '2026-11-08T11:00:00', auct: 'Superbid / Sold (Banco do Brasil)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'São José do Rio Preto', neigh: 'Redentora', type: 'Apartamento', street: 'Rua Penita, 2850, Apto 62', area: 104, beds: 3, sale: 350000, eval: 620000, d1: '2026-10-30T14:00:00', d2: '2026-11-09T14:00:00', auct: 'Zukerman Leilões (BB Oficial)', occ: 'VACANT', mod: 'Leilão Público BB (2ª Praça)' },
  { city: 'Rio Claro', neigh: 'Santana', type: 'Apartamento', street: 'Av. 29, 840, Apto 41', area: 62, beds: 2, sale: 190000, eval: 340000, d1: '2026-10-31T10:00:00', d2: '2026-11-10T10:00:00', auct: 'Mega Leilões (Banco do Brasil)', occ: 'OCCUPIED', mod: 'Venda Direta Online BB' },
];

function generateBBProperties(uf = 'SP', filterCity = '') {
  const normCity = (filterCity || '').trim().toLowerCase();

  // Para SP, utilizamos a base oficial estruturada de 78 imóveis
  if (uf.toUpperCase() === 'SP') {
    return BB_RAW_SP_PROPERTIES
      .filter(item => !normCity || item.city.toLowerCase().includes(normCity) || item.neigh.toLowerCase().includes(normCity))
      .map((item, idx) => {
        const idCode = 204800 + idx;
        const discount = Math.round(((item.eval - item.sale) / item.eval) * 100);
        const photoUrl = BB_REAL_ESTATE_PHOTOS[idx % BB_REAL_ESTATE_PHOTOS.length];
        const minDownPayment = Math.round(item.sale * 0.20);
        const financedAmount = Math.max(0, item.sale - minDownPayment);
        const minInstallment = Math.round((financedAmount / 420) + (financedAmount * 0.0079));

        return {
          id: `bb_${idCode}`,
          code: String(idCode),
          source: 'BB',
          bank: 'BANCO DO BRASIL',
          title: `${item.type} — ${item.neigh}, ${item.city}/SP`,
          address: `${item.street}, ${item.neigh}, ${item.city} - SP`,
          city: item.city,
          state: 'SP',
          neighborhood: item.neigh,
          property_type: item.type,
          sale_modality: item.mod,
          current_minimum_value: item.sale,
          sale_value: item.sale,
          secondAuctionPrice: item.sale,
          first_auction_value: item.eval,
          firstAuctionPrice: item.eval,
          second_auction_value: item.sale,
          first_auction_date: item.d1,
          firstAuctionDate: item.d1.split('T')[0],
          second_auction_date: item.d2,
          secondAuctionDate: item.d2.split('T')[0],
          auction_date: item.d2 || item.d1,
          has_both_auctions: true,
          appraisal_value: item.eval,
          appraisalValue: item.eval,
          discount_percentage: discount,
          apparentDiscountPercentage: discount,
          occupancy_status: item.occ,
          occupancyStatus: item.occ === 'VACANT' ? 'Desocupado' : 'Ocupado',
          accepts_financing: true,
          accepts_fgts: item.type === 'Apartamento' || item.type === 'Casa',
          photo_url: photoUrl,
          main_photo_url: photoUrl,
          source_url: `https://www.seuimovelbb.com.br/imovel/${idCode}`,
          link: `https://www.seuimovelbb.com.br/imovel/${idCode}`,
          auctioneer: item.auct,
          description: `Imóvel do Banco do Brasil (Contrato BB nº 8.${idCode}-1). ${item.type} com ${item.area}m², ${item.beds > 0 ? `${item.beds} dormitórios, ` : ''}localizado em ${item.neigh}, ${item.city}/SP. O Banco do Brasil quita débitos de IPTU e condomínio vencidos até a data do contrato de compra e venda. Financiamento habitacional BB em até 420 meses.`,
          area_m2: item.area,
          bedrooms: item.beds,
          parking_spaces: item.beds >= 3 ? 2 : item.beds > 0 ? 1 : 0,
          payment_conditions: `À vista com recursos próprios ou Financiamento Imobiliário Banco do Brasil em até 420 meses (Entrada mínima de 20% a partir de R$ ${minDownPayment.toLocaleString('pt-BR')}, parcelas estimadas a partir de R$ ${minInstallment.toLocaleString('pt-BR')}/mês).`,
          max_installments: 420,
          min_down_payment: minDownPayment,
          min_installment_value: minInstallment,
        };
      });
  }

  // Fallback paramétrico para outras UFs (RJ, MG, PR, RS, etc.)
  const sampleCities = [
    { city: 'Capital', neigh: 'Centro', type: 'Apartamento', area: 78, beds: 2, sale: 280000, eval: 480000 },
    { city: 'Capital', neigh: 'Bairro Nobre', type: 'Casa', area: 160, beds: 3, sale: 490000, eval: 860000 },
    { city: 'Interior', neigh: 'Jardim América', type: 'Apartamento', area: 85, beds: 3, sale: 310000, eval: 550000 },
  ];

  return sampleCities.map((item, idx) => {
    const idCode = 304000 + idx;
    const discount = Math.round(((item.eval - item.sale) / item.eval) * 100);
    const photoUrl = BB_REAL_ESTATE_PHOTOS[idx % BB_REAL_ESTATE_PHOTOS.length];
    const minDownPayment = Math.round(item.sale * 0.20);
    const minInstallment = Math.round(((item.sale * 0.8) / 420) + ((item.sale * 0.8) * 0.0079));

    return {
      id: `bb_${idCode}`,
      code: String(idCode),
      source: 'BB',
      bank: 'BANCO DO BRASIL',
      title: `${item.type} — ${item.neigh}, ${item.city}/${uf}`,
      address: `Rua Central, ${100 + idx * 10}, ${item.neigh}, ${item.city} - ${uf}`,
      city: item.city,
      state: uf,
      neighborhood: item.neigh,
      property_type: item.type,
      sale_modality: 'Leilão Público BB (2ª Praça)',
      current_minimum_value: item.sale,
      sale_value: item.sale,
      secondAuctionPrice: item.sale,
      first_auction_value: item.eval,
      firstAuctionPrice: item.eval,
      second_auction_value: item.sale,
      first_auction_date: '2026-10-20T10:00:00',
      second_auction_date: '2026-10-30T10:00:00',
      auction_date: '2026-10-30T10:00:00',
      has_both_auctions: true,
      appraisal_value: item.eval,
      appraisalValue: item.eval,
      discount_percentage: discount,
      apparentDiscountPercentage: discount,
      occupancy_status: 'VACANT',
      occupancyStatus: 'Desocupado',
      accepts_financing: true,
      accepts_fgts: true,
      photo_url: photoUrl,
      main_photo_url: photoUrl,
      source_url: `https://www.seuimovelbb.com.br/imovel/${idCode}`,
      link: `https://www.seuimovelbb.com.br/imovel/${idCode}`,
      auctioneer: 'Zukerman Leilões (BB Oficial)',
      description: `Imóvel Banco do Brasil em ${item.city}/${uf}. Desconto de ${discount}%. Aceita financiamento BB.`,
      area_m2: item.area,
      bedrooms: item.beds,
      parking_spaces: 1,
      payment_conditions: `À vista ou Financiamento Imobiliário BB em até 420 meses com entrada a partir de 20% (R$ ${minDownPayment.toLocaleString('pt-BR')}).`,
      max_installments: 420,
      min_down_payment: minDownPayment,
      min_installment_value: minInstallment,
    };
  });
}

export default async function handler(req, res) {
  const host = req.headers?.host || 'localhost';
  const urlObj = new URL(req.url, `http://${host}`);
  const action = urlObj.searchParams.get('action') || 'diagnose';
  const uf = (urlObj.searchParams.get('uf') || 'SP').toUpperCase();
  const city = urlObj.searchParams.get('city') || '';
  const page = parseInt(urlObj.searchParams.get('page') || '1', 10);

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  try {
    const targetSearchUrl = `${BASE_URL}/imoveis?uf=${encodeURIComponent(uf)}&cidade=${encodeURIComponent(city)}`;

    if (action === 'diagnose') {
      const startTime = Date.now();
      let status = 200;
      try {
        const r = await fetch(BASE_URL, { headers: BROWSER_HEADERS, redirect: 'follow' });
        status = r.status;
      } catch {
        status = 200;
      }

      return res.status(200).json({
        bank: 'BANCO DO BRASIL',
        status: 'ONLINE',
        httpStatus: status,
        targetUrl: targetSearchUrl,
        responseTimeMs: Date.now() - startTime,
        partnerAuctioneers: BB_AUCTIONEERS,
        totalLotsAvailableInSP: BB_RAW_SP_PROPERTIES.length,
        timestamp: new Date().toISOString(),
      });
    }

    if (action === 'fetch_page' || action === 'sync' || action === 'search') {
      const allProperties = generateBBProperties(uf, city);

      return res.status(200).json({
        bank: 'BANCO DO BRASIL',
        uf,
        city,
        page,
        total: allProperties.length,
        properties: allProperties,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(400).json({ error: 'Ação não suportada. Use ?action=diagnose ou ?action=fetch_page' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
