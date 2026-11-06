/**
 * Compara o preço de venda com uma busca digitada.
 * Aceita exemplos como 10, 10,50, 10.50 e R$ 10,50.
 */
export function produtoCorrespondeBuscaPreco(
  preco: number | null | undefined,
  busca: string
): boolean {
  if (preco == null || !Number.isFinite(Number(preco))) return false;

  const termo = busca.trim().toLowerCase().replace(/^r\$\s*/, "").replace(/\s/g, "");
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(termo)) return false;

  const valorBuscado = Number(termo.replace(",", "."));
  return Number.isFinite(valorBuscado) &&
    Math.round(Number(preco) * 100) === Math.round(valorBuscado * 100);
}

/**
 * Retorna o preço pesquisado para o PDV.
 * Números inteiros sem R$ continuam reservados para código de barras.
 */
export function interpretarBuscaPreco(busca: string): number | null {
  const original = busca.trim().toLowerCase();
  const termo = original.replace(/^r\$\s*/, "").replace(/\s/g, "");

  if (!/^\d+(?:[.,]\d{1,2})?$/.test(termo)) return null;
  if (!original.startsWith("r$") && !/[.,]/.test(termo)) return null;

  const valor = Number(termo.replace(",", "."));
  return Number.isFinite(valor) ? valor : null;
}
