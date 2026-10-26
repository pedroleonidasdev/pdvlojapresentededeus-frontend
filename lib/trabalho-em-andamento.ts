/**
 * Registro simples de "tem trabalho em andamento nesta tela" (ex.: venda com itens no
 * carrinho). O aviso de atualização consulta isso para NÃO reiniciar sozinho no meio de
 * uma venda — o carrinho não é guardado e se perderia ao recarregar a página.
 */
const motivos = new Set<string>();

export function definirTrabalhoEmAndamento(motivo: string, ativo: boolean) {
  if (ativo) motivos.add(motivo);
  else motivos.delete(motivo);
}

export function haTrabalhoEmAndamento(): boolean {
  return motivos.size > 0;
}
