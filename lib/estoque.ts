import { Produto } from "./types";

/**
 * Situação do estoque de um produto:
 *  - "em-falta": acabou (quantidade zerada ou negativa)
 *  - "baixo":    ainda tem, mas está no mínimo cadastrado ou abaixo dele
 *  - "ok":       estoque saudável (ou produto inativo / sem mínimo definido)
 *
 * Produtos inativos nunca geram alerta (mesma regra da tela Início).
 */
export type SituacaoEstoque = "em-falta" | "baixo" | "ok";

export function situacaoEstoque(produto: Produto): SituacaoEstoque {
  if (produto.ativo === false) return "ok";
  if (produto.quantidadeEstoque <= 0) return "em-falta";
  if (produto.estoqueMinimo != null && produto.quantidadeEstoque <= produto.estoqueMinimo) {
    return "baixo";
  }
  return "ok";
}

/** Peso para ordenar do mais crítico (em falta) para o menos crítico (ok). */
export function pesoSituacao(situacao: SituacaoEstoque): number {
  return situacao === "em-falta" ? 0 : situacao === "baixo" ? 1 : 2;
}
