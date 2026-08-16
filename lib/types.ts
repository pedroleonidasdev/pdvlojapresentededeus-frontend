export type Perfil = "ADMIN" | "CAIXA";

export type FormaPagamento = "PIX" | "DINHEIRO" | "CARTAO_CREDITO" | "CARTAO_DEBITO";

export interface Usuario {
  login: string;
  nome: string;
  perfil: Perfil;
}

export interface Categoria {
  id: number;
  nome: string;
}

export interface Produto {
  id: number;
  nome: string;
  codigoBarras: string | null;
  categoria: Categoria | null;
  precoVenda: number;
  precoCusto: number | null;
  quantidadeEstoque: number;
  estoqueMinimo: number | null;
  ativo: boolean;
}

export interface ItemVenda {
  id: number;
  produto: Produto;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

export interface ItemVendaResponse {
  id: number;
  produtoId: number;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

export interface Venda {
  id: number;
  usuarioNome: string;
  dataHora: string;
  formaPagamento: FormaPagamento;
  total: number;
  itens: ItemVendaResponse[];
}

export interface RelatorioVendas {
  totalFaturado: number;
  quantidadeVendas: number;
  totalPorFormaPagamento: Record<string, number>;
  produtosMaisVendidos: {
    nome: string;
    quantidadeVendida: number;
    totalVendido: number;
  }[];
}

export interface UsuarioAdmin {
  id: number;
  login: string;
  nome: string;
  perfil: Perfil;
  ativo: boolean;
}
