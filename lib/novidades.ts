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
    id: "2026-10-28-atualizacao-e-chat",
    data: "2026-10-28",
    titulo: "Atualização obrigatória, caixinha de aviso e chat estilo WhatsApp",
    itens: [
      "Ao entrar no sistema, ele confere se há versão nova e se atualiza antes de liberar a operação, com uma barra mostrando o andamento.",
      "Com o sistema aberto, quando sai uma versão nova aparece o aviso “Há uma nova versão do sistema”, com os botões “Atualizar agora” e “Mais tarde”.",
      "Se escolher “Mais tarde”, a caixinha “Atualização disponível” fica na tela até você atualizar.",
      "Quando o servidor está reiniciando ou atualizando, aparece o aviso “Atualizando o servidor…” e, ao voltar, a confirmação de que já pode continuar as vendas.",
      "O chat de Conversas ganhou visual no estilo WhatsApp, e o pop-up de nova mensagem ficou mais visível.",
    ],
  },
  {
    id: "2026-10-27-chat-leitura-e-login",
    data: "2026-10-27",
    titulo: "Chat com confirmação de leitura e login por aba",
    itens: [
      "No chat, agora dá para ver quando a mensagem foi lida. O visual foi renovado e há um som ao chegar mensagem nova.",
      "O pop-up de nova mensagem ficou mais fácil de perceber.",
      "Uma aba nova não herda mais o login de outra aba: cada aba mantém o seu usuário.",
    ],
  },
  {
    id: "2026-10-26-atualizacao-em-etapas",
    data: "2026-10-26",
    titulo: "Atualização com barra de progresso e abrir caixa mais limpo",
    itens: [
      "Ao atualizar, uma barra de progresso mostra as etapas: verificando, baixando, preparando e reiniciando. O seu login é mantido.",
      "Sem venda em andamento, o sistema reinicia sozinho depois de uma contagem. Com venda em andamento, ele espera você terminar, porque o carrinho se perderia.",
      "A janela de abrir o caixa ficou mais limpa e profissional.",
    ],
  },
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
    id: "2026-10-24-visual-e-pop-up",
    data: "2026-10-24",
    titulo: "Novo visual e pop-up de mensagem",
    itens: [
      "Visual novo nas telas de Categorias, Usuários, Caixa e nas janelas (modais), além do login e do Estoque.",
      "No Estoque: indicadores no topo, filtros em chips e uma tabela nova.",
      "A tela de Venda ficou mais clara e compacta.",
      "No Início, uma faixa compacta mostra o valor de abertura do caixa, os cartões de resumo repetidos saíram e o menu lateral mostra só o selo do caixa.",
      "Aparece um pop-up quando chega uma nova mensagem no chat.",
      "Nos consignados, o código de barras agora aparece abaixo do código no PDF.",
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
  {
    id: "2026-10-10-consignados-faturamento",
    data: "2026-10-10",
    titulo: "Consignados no Faturamento",
    itens: [
      "Consignações fechadas entram no Faturamento e nas Finanças: vale o valor vendido menos a comissão do consignatário.",
      "Na nova consignação, o item sem estoque pode ser tirado da lista com o botão “Remover”.",
      "A lista de produtos ganhou caixinha de busca com resultados por relevância.",
      "No relatório, a coluna COD. mostra o código de barras do estoque.",
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
