export type Perfil = "ADMIN" | "CAIXA";

export type FormaPagamento =
  | "PIX"
  | "DINHEIRO"
  | "CARTAO_CREDITO"
  | "CARTAO_DEBITO"
  | "CHEQUE"
  | "BOLETO"
  | "MULTIPLO";

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

export interface PagamentoVenda {
  formaPagamento: Exclude<FormaPagamento, "MULTIPLO">;
  valor: number;
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
  pagamentos: PagamentoVenda[];
}

export type TipoItemTroca = "DEVOLVIDO" | "NOVO";

export interface ItemTrocaResponse {
  id: number;
  produtoId: number;
  produtoNome: string;
  tipo: TipoItemTroca;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

export interface Troca {
  id: number;
  usuarioNome: string;
  dataHora: string;
  vendaOrigemId: number | null;
  observacao: string | null;
  valorDevolvido: number;
  valorNovo: number;
  diferenca: number;
  formaPagamentoDiferenca: FormaPagamento | null;
  itensDevolvidos: ItemTrocaResponse[];
  itensNovos: ItemTrocaResponse[];
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
  online: boolean;
  ultimoAcessoHaSeg: number | null;
}

export interface Caixa {
  id: number;
  usuarioAberturaNome: string;
  /** Login de quem abriu (usado para saber se é a mesma pessoa logada agora). */
  usuarioAberturaLogin: string | null;
  valorInicial: number;
  dataAbertura: string;
  usuarioFechamentoNome: string | null;
  valorFinal: number | null;
  dataFechamento: string | null;
  aberto: boolean;
  usuarioReaberturaNome: string | null;
  dataReabertura: string | null;
  /** Valor digitado originalmente, quando o valor de abertura foi corrigido (senão null). */
  valorInicialOriginal: number | null;
  usuarioEdicaoAberturaNome: string | null;
  dataEdicaoAbertura: string | null;
  /** Quem está online agora (ausente se o backend for antigo). */
  operadoresOnline?: { nome: string; login: string }[];
}

export type TipoDespesa = "DESPESA" | "SANGRIA" | "SUPRIMENTO";

export interface Parcela {
  numero: number;
  dataVencimento: string | null;
  valor: number;
  pago: boolean;
}

export interface Despesa {
  id: number;
  tipo: TipoDespesa;
  categoria: string | null;
  fornecedor: string | null;
  descricao: string;
  valor: number;
  formaPagamento: FormaPagamento;
  dataHora: string;
  dataVencimento: string | null;
  usuarioNome: string;
  caixaId: number | null;
  numeroParcelas: number | null;
  parcelas: Parcela[];
  pago: boolean;
}

export type StatusConsignacao = "ABERTA" | "FECHADA";

export interface ItemConsignacao {
  id: number;
  produtoId: number;
  produtoNome: string;
  codigoBarras: string | null;
  categoriaNome: string | null;
  quantidadeEnviada: number;
  quantidadeVendida: number;
  quantidadeDevolvida: number;
  precoUnitario: number;
  percentualComissao: number;
  valorEnviado: number;
  valorVendido: number;
  comissao: number;
}

export interface Consignacao {
  id: number;
  usuarioNome: string;
  dataHora: string;
  consignatario: string;
  /** "YYYY-MM-DD" (data combinada para devolver o que não for vendido) */
  prazoDevolucao: string | null;
  observacao: string | null;
  status: StatusConsignacao;
  dataFechamento: string | null;
  totalEnviado: number;
  totalVendido: number;
  totalComissao: number;
  totalLiquidoLoja: number;
  itens: ItemConsignacao[];
}
