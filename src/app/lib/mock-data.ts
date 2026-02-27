
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
  comissao_percentual: number;
  satisfacao_nps: number;
}

export interface LeadRecord {
  id: string;
  data: string;
  origem: string;
  corretor: string;
  status: 'Novo' | 'Convertido' | 'Perdido';
}

export interface VisitRecord {
  id: string;
  data: string;
  tipo: 'Venda' | 'Aluguel';
  bairro: string;
  corretor: string;
  concluida: boolean;
}

export const brokers = ['Claudia', 'Henrique', 'João', 'Mila', 'Orlei', 'Felipe', 'Eduardo', 'Wagner', 'Ane'];
export const origins = [
  'Imóvel Web', 
  'Chaves na Mão', 
  'Grupo Zap', 
  'Site', 
  'Google', 
  'Meta', 
  'Instagram', 
  'Indicação/Relacionamento', 
  'PDV'
];
export const neighborhoods = ['Jardins', 'Moema', 'Itaim Bibi', 'Pinheiros', 'Vila Madalena', 'Brooklin', 'Campo Belo'];

const generateMockSales = (count: number): SaleRecord[] => {
  const sales: SaleRecord[] = [];
  
  for (let i = 0; i < count; i++) {
    const isSale = Math.random() > 0.3;
    const month = Math.floor(Math.random() * 12);
    const day = Math.floor(Math.random() * 28) + 1;
    const entryDate = new Date(2024, month - 3, day);
    const saleDate = new Date(2024, month, day);

    const anuncio = isSale ? Math.floor(Math.random() * 1200000) + 400000 : Math.floor(Math.random() * 8000) + 2500;
    const fechado = anuncio * (0.88 + Math.random() * 0.12);

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
      bairro: neighborhoods[Math.floor(Math.random() * neighborhoods.length)],
      comissao_percentual: isSale ? (5 + Math.random()) : 100, // 5-6% venda, 100% primeiro aluguel
      satisfacao_nps: Math.floor(Math.random() * 3) + 8 // 8 a 10
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
      corretor: brokers[Math.floor(Math.random() * brokers.length)],
      status: Math.random() > 0.7 ? 'Convertido' : 'Novo'
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
      bairro: neighborhoods[Math.floor(Math.random() * neighborhoods.length)],
      corretor: brokers[Math.floor(Math.random() * brokers.length)],
      concluida: true
    });
  }
  return visits;
};

export const MOCK_SALES_DATA = generateMockSales(120);
export const MOCK_LEADS_DATA = generateMockLeads(450);
export const MOCK_VISITS_DATA = generateMockVisits(320);
export const MOCK_PROPERTIES_IN_STOCK = 250;
export const MOCK_VGV_TOTAL = 150000000; // 150 Milhões em estoque
