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
  subtotal?: number;
  percentualDesconto?: number;
  valorDesconto?: number;
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

export interface Caixa {
  id: number;
  usuarioAberturaNome: string;
  valorInicial: number;
  dataAbertura: string;
  usuarioFechamentoNome: string | null;
  valorFinal: number | null;
  dataFechamento: string | null;
  aberto: boolean;
}
