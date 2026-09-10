import { Venda } from "@/lib/types";

const AGENTE_CUPOM_URL =
  process.env.NEXT_PUBLIC_GOLDENSKY_CUPOM_URL ?? "http://localhost:9100/imprimir-cupom";

export async function imprimirCupom(venda: Venda): Promise<void> {
  const resposta = await fetch(AGENTE_CUPOM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: venda.id,
      usuarioNome: venda.usuarioNome,
      dataHora: venda.dataHora,
      formaPagamento: venda.formaPagamento,
      subtotal: venda.subtotal,
      percentualDesconto: venda.percentualDesconto,
      valorDesconto: venda.valorDesconto,
      total: venda.total,
      itens: venda.itens.map((item) => ({
        id: item.id,
        produtoNome: item.produtoNome,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        subtotal: item.subtotal,
      })),
    }),
  });

  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new Error(
      dados?.mensagem ??
        "Não foi possível imprimir o cupom. Verifique se o agente Goldensky está em execução."
    );
  }
}
