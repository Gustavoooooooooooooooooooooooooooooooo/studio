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
}

export const brokers = ['Claudia', 'Mila', 'Henrique', 'Rafael', 'Beatriz'];
export const origins = ['Imóvel Web', 'Zap', 'Google', 'Site', 'Instagram', 'Indicação'];

const generateMockSales = (count: number): SaleRecord[] => {
  const sales: SaleRecord[] = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const monthsAgo = Math.floor(Math.random() * 12);
    const day = Math.floor(Math.random() * 28) + 1;
    const entryDate = new Date(2024, now.getMonth() - monthsAgo - 2, day);
    const saleDate = new Date(entryDate);
    saleDate.setDate(saleDate.getDate() + Math.floor(Math.random() * 90) + 10);

    const anuncio = Math.floor(Math.random() * 500000) + 300000;
    const fechado = anuncio * (0.9 + Math.random() * 0.1);

    sales.push({
      id_imovel: `IM-${1000 + i}`,
      data_entrada: entryDate.toISOString().split('T')[0],
      data_venda: saleDate.toISOString().split('T')[0],
      origem: origins[Math.floor(Math.random() * origins.length)],
      cliente: `Cliente ${i + 1}`,
      corretor: brokers[Math.floor(Math.random() * brokers.length)],
      valor_anuncio: Math.round(anuncio),
      valor_fechado: Math.round(fechado),
      status: 'Vendido'
    });
  }
  return sales.sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime());
};

export const MOCK_SALES_DATA = generateMockSales(45);