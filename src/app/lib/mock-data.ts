export interface SaleRecord {
  id_imovel: string;
  data_entrada: string;
  data_venda: string;
  origem: string;
  cliente: string;
  corretor: string;
  valor_anuncio: number;
  valor_fechado: number;
  status: 'Vendido';
  tipo: 'Venda' | 'Aluguel';
  bairro: string;
}

export interface LeadRecord {
  id: string;
  data: string;
  origem: string;
  corretor: string;
}

export interface VisitRecord {
  id: string;
  data: string;
  tipo: 'Venda' | 'Aluguel';
  bairro: string;
}

export const brokers = ['Claudia', 'Henrique', 'João', 'Mila', 'Oriel', 'Felipe', 'Eduardo'];
export const origins = [
  'Imóvel Web', 
  'Grupo Zap', 
  'Chaves na Mão', 
  'Site', 
  'Google', 
  'Instagram', 
  'Facebook', 
  'Indicação/Relacionamento', 
  'PDV', 
  'NiD'
];
export const neighborhoods = ['Jardins', 'Moema', 'Itaim Bibi', 'Pinheiros', 'Vila Madalena', 'Brooklin', 'Campo Belo'];

const generateMockSales = (count: number): SaleRecord[] => {
  const sales: SaleRecord[] = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const isSale = Math.random() > 0.3;
    // Distribuir ao longo do ano de 2024
    const month = Math.floor(Math.random() * 12);
    const day = Math.floor(Math.random() * 28) + 1;
    const entryDate = new Date(2024, month - 2, day);
    const saleDate = new Date(2024, month, day);

    const anuncio = isSale ? Math.floor(Math.random() * 800000) + 400000 : Math.floor(Math.random() * 5000) + 2500;
    const fechado = anuncio * (0.92 + Math.random() * 0.08);

    sales.push({
      id_imovel: `IM-${1000 + i}`,
      data_entrada: entryDate.toISOString().split('T')[0],
      data_venda: saleDate.toISOString().split('T')[0],
      origem: origins[Math.floor(Math.random() * origins.length)],
      cliente: `Cliente ${i + 1}`,
      corretor: brokers[Math.floor(Math.random() * brokers.length)],
      valor_anuncio: Math.round(anuncio),
      valor_fechado: Math.round(fechado),
      status: 'Vendido',
      tipo: isSale ? 'Venda' : 'Aluguel',
      bairro: neighborhoods[Math.floor(Math.random() * neighborhoods.length)]
    });
  }
  return sales.sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime());
};

const generateMockLeads = (count: number): LeadRecord[] => {
  const leads: LeadRecord[] = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
    leads.push({
      id: `L-${i}`,
      data: date.toISOString().split('T')[0],
      origem: origins[Math.floor(Math.random() * origins.length)],
      corretor: brokers[Math.floor(Math.random() * brokers.length)]
    });
  }
  return leads;
};

const generateMockVisits = (count: number): VisitRecord[] => {
  const visits: VisitRecord[] = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
    visits.push({
      id: `V-${i}`,
      data: date.toISOString().split('T')[0],
      tipo: Math.random() > 0.5 ? 'Venda' : 'Aluguel',
      bairro: neighborhoods[Math.floor(Math.random() * neighborhoods.length)]
    });
  }
  return visits;
};

export const MOCK_SALES_DATA = generateMockSales(80);
export const MOCK_LEADS_DATA = generateMockLeads(150);
export const MOCK_VISITS_DATA = generateMockVisits(200);
