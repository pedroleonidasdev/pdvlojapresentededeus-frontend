import { Consignacao } from "./types";

/**
 * Consignações entram no faturamento só quando FECHADAS (é no acerto que a
 * venda acontece e o estoque dá baixa), e no dia do fechamento. Consignação em
 * aberto é só mercadoria emprestada: não é receita.
 *
 * inicioUtc/fimUtc vêm de limiteDiaBrasiliaParaUtc ("YYYY-MM-DDTHH:mm:ss", UTC
 * "cru"), o mesmo formato de dataFechamento — por isso a comparação de texto
 * funciona (cortamos as frações de segundo para não errar na borda do dia).
 */
export function consignacoesFechadasNoPeriodo(
  lista: Consignacao[],
  inicioUtc: string,
  fimUtc: string
): Consignacao[] {
  return lista.filter((c) => {
    if (c.status !== "FECHADA" || !c.dataFechamento) return false;
    const fechamento = c.dataFechamento.slice(0, 19);
    return fechamento >= inicioUtc && fechamento <= fimUtc;
  });
}

export interface ResumoConsignados {
  quantidade: number;
  /** Valor vendido pelos consignatários (preço cheio). */
  totalVendido: number;
  /** Comissão que fica com o consignatário. */
  totalComissao: number;
  /** O que realmente sobra para a loja (vendido − comissão). */
  totalLiquido: number;
}

export function resumirConsignacoes(lista: Consignacao[]): ResumoConsignados {
  let totalVendido = 0;
  let totalComissao = 0;
  for (const c of lista) {
    totalVendido += c.totalVendido;
    totalComissao += c.totalComissao;
  }
  totalVendido = Math.round(totalVendido * 100) / 100;
  totalComissao = Math.round(totalComissao * 100) / 100;
  return {
    quantidade: lista.length,
    totalVendido,
    totalComissao,
    totalLiquido: Math.round((totalVendido - totalComissao) * 100) / 100,
  };
}
