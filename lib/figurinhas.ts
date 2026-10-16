/** Emojis e figurinhas do chat. Tudo é texto Unicode: não precisa de imagem nem de upload. */

export interface CategoriaEmoji {
  id: string;
  nome: string;
  icone: string;
  emojis: string[];
}

// Separa uma sequência de emojis em itens (um emoji pode ter vários caracteres, como ❤️).
// Regex em vez de Intl.Segmenter, que navegadores mais antigos não têm.
const EMOJI = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*/gu;
const e = (texto: string): string[] => texto.match(EMOJI) ?? [];

export const CATEGORIAS_EMOJI: CategoriaEmoji[] = [
  {
    id: "carinhas",
    nome: "Carinhas",
    icone: "😀",
    emojis: e("😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗😚😋😛😜🤪😝🤑🤗🤭🤫🤔🤐🤨😐😑😶😏😒🙄😬😌😔😪🤤😴😷🤒🤕🤢🤮🤧🥵🥶🥴😵🤯🤠🥳😎🤓🧐😕😟🙁😮😯😲😳🥺😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈👿💀💩🤡👻👽🤖"),
  },
  {
    id: "gestos",
    nome: "Gestos",
    icone: "👍",
    emojis: e("👋🤚✋🖖👌🤌🤏✌️🤞🤟🤘🤙👈👉👆👇☝️👍👎✊👊🤛🤜👏🙌👐🤲🤝🙏✍️💪👀👅👄"),
  },
  {
    id: "coracoes",
    nome: "Corações",
    icone: "❤️",
    emojis: e("❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝💯💢💥💫💦💨💬💭💤🔥✨⭐🌟🎉🎊🎁🏆🥇"),
  },
  {
    id: "fe",
    nome: "Fé",
    icone: "🙏",
    emojis: e("🙏✝️⛪🕊️📿🕯️😇🌹💒🌷🌻🕍☮️✨"),
  },
  {
    id: "loja",
    nome: "Loja",
    icone: "🛍️",
    emojis: e("🛍️🛒💰💵💳🧾📦🏷️📱💻🖨️📞📷🔑🔒🕐⏰📅📝📌📎✂️🔧🧹✅❌⭕⚠️🚫❓❗🔔"),
  },
  {
    id: "comida",
    nome: "Comida",
    icone: "☕",
    emojis: e("☕🍺🍻🥂🍕🍔🍟🌭🥪🌮🍿🍩🍪🎂🍰🍫🍬🍎🍌🍉🍇🍓🥑🥗🍽️"),
  },
  {
    id: "natureza",
    nome: "Natureza e lugares",
    icone: "☀️",
    emojis: e("☀️🌤️⛅🌧️⛈️🌈❄️🌙🌳🐶🐱🐴🦋🚗🚌🏍️✈️🏠🏪"),
  },
];

/** Figurinha só com um emoji grande. */
export const FIGURINHAS_EMOJI: string[] = e(
  "🤣😍😎🥳😭😡🤔🥺😴🤯🙄😅🤷🫡🙏👏🙌👍👎🤝💪🔥❤️💯🎉✅❌☕🚀🎁🏆"
);

/** Figurinhas com texto, pensadas para o dia a dia da loja. */
export const FIGURINHAS_TEXTO: string[] = [
  "Bom dia! ☀️",
  "Boa tarde! 🌤️",
  "Boa noite! 🌙",
  "Valeu! 🙌",
  "Obrigado! 🙏",
  "Ok! 👍",
  "Beleza! 😎",
  "Combinado! 🤝",
  "Já vou! 🏃",
  "Um momento ⏳",
  "Pode ser! ✅",
  "Fechou! 💰",
  "Boa venda! 🛍️",
  "Café? ☕",
  "Almoço? 🍽️",
  "Atenção! ⚠️",
  "Urgente! 🚨",
  "Sem estoque 📦",
  "Deus abençoe! 🙏",
  "Parabéns! 🎉",
];

/** Figurinha "de texto" tem letras ou números; as de emoji são só símbolos. */
export function figurinhaTemTexto(conteudo: string): boolean {
  return /[\p{L}\p{N}]/u.test(conteudo);
}

/** Mensagem comum só com emojis (sem letras) é mostrada maior, como nos mensageiros. */
export function soEmojis(conteudo: string): boolean {
  return conteudo.length <= 12 && !figurinhaTemTexto(conteudo);
}
