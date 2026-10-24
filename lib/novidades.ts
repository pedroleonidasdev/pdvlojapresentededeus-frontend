/**
 * Histórico de novidades do sistema, mostrado na caixa "Novidades".
 *
 * COMO ADICIONAR UMA NOVIDADE: acrescente um objeto NO TOPO da lista (a mais nova primeiro),
 * com um `id` que nunca se repete (ex.: "2026-11-05-relatorios"). Ao publicar, a caixa abre
 * sozinha uma vez para cada pessoa e o menu mostra o selo "NOVO" até abrirem.
 */
export interface Novidade {
  /** Identificador único e estável. Mudou o id da primeira da lista = todo mundo vê o aviso de novo. */
  id: string;
  /** "YYYY-MM-DD" */
  data: string;
  titulo: string;
  itens: string[];
}

export const NOVIDADES: Novidade[] = [
  {
    id: "2026-10-24-conversas-no-menu",
    data: "2026-10-24",
    titulo: "Conversas agora fica no menu",
    itens: [
      "O balão “Conversas” saiu do canto da tela, onde atrapalhava a venda. Agora o botão “Conversas” fica no rodapé do menu lateral, com o número de mensagens não lidas.",
      "No celular, o botão fica na barra verde do topo, ao lado do nome do sistema.",
      "Ao abrir, a janela da conversa aparece ao lado do menu. Para fechar, use o X ou clique em “Conversas” de novo.",
    ],
  },
  {
    id: "2026-10-21-chat-anexos",
    data: "2026-10-21",
    titulo: "Anexar arquivos no chat",
    itens: [
      "No chat de Conversas, use o clipe (📎) para enviar arquivos de qualquer formato: PDF, planilhas, documentos, fotos, áudios e mais.",
      "Também dá para arrastar o arquivo para dentro da conversa ou colar um print com Ctrl+V.",
      "Imagens aparecem em miniatura (clique para ampliar). Os outros arquivos viram um cartão: toque para baixar.",
      "Cada arquivo pode ter até 5 MB e fica disponível por 7 dias. Depois disso a mensagem continua, mas o arquivo expira.",
    ],
  },
  {
    id: "2026-10-21-aviso-atualizacao",
    data: "2026-10-21",
    titulo: "Aviso de atualização mais seguro",
    itens: [
      "O aviso “Nova atualização disponível” agora lembra de terminar a venda em andamento antes de atualizar, porque o carrinho não é guardado ao recarregar.",
      "O leitor de código de barras não aciona mais o botão “Atualizar agora” sem querer: o foco inicial ficou em “Mais tarde”.",
    ],
  },
  {
    id: "2026-10-21-consignados-precos",
    data: "2026-10-21",
    titulo: "Preços nos consignados",
    itens: [
      "Na conferência, agora dá para corrigir o preço de cada item antes de fechar a consignação. Os totais e a comissão recalculam na hora.",
      "Consignações já fechadas também podem ter o preço corrigido em “Editar conferência”. O estoque só muda se você alterar as quantidades.",
      "Ao mudar o preço de um produto no cadastro, as consignações em aberto acompanham o novo preço. Itens que você já tinha ajustado à mão ficam como estão.",
      "Agora é possível usar preço R$ 0,00 (por exemplo, para brindes).",
      "O botão de salvar a edição de uma consignação fechada agora se chama “Salvar conferência corrigida”.",
    ],
  },
];

/** Chave do navegador onde fica guardado o id da última novidade que a pessoa viu. */
export const CHAVE_NOVIDADE_VISTA = "pdv_novidade_vista";
/** Evento disparado para abrir a caixa (usado pelo botão do menu). */
export const EVENTO_ABRIR_NOVIDADES = "pdv:abrir-novidades";
/** Evento disparado quando a pessoa já viu as novidades (apaga o selo "NOVO"). */
export const EVENTO_NOVIDADES_VISTAS = "pdv:novidades-vistas";

export const ID_NOVIDADE_MAIS_NOVA = NOVIDADES[0]?.id ?? "";

/** true se existe novidade que este navegador ainda não viu. */
export function temNovidadeNaoVista(): boolean {
  if (typeof window === "undefined" || !ID_NOVIDADE_MAIS_NOVA) return false;
  try {
    return localStorage.getItem(CHAVE_NOVIDADE_VISTA) !== ID_NOVIDADE_MAIS_NOVA;
  } catch {
    return false;
  }
}

export function marcarNovidadesVistas() {
  try {
    localStorage.setItem(CHAVE_NOVIDADE_VISTA, ID_NOVIDADE_MAIS_NOVA);
  } catch {
    // sem localStorage: o aviso só vai reaparecer na próxima abertura
  }
  window.dispatchEvent(new Event(EVENTO_NOVIDADES_VISTAS));
}
