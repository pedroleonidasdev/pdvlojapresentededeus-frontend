import api from "@/lib/api";

export interface LinhaLida {
  itemId: number;
  produtoNome: string;
  codigoBarras: string | null;
  enviada: number;
  qtdVendida: number;
  valorLido: number | null;
  valorEsperado: number;
  incerto: boolean;
  avisos: string[];
}

export interface LeituraPagina {
  linhas: LinhaLida[];
  naoEncontradas: string[];
  totalManuscrito: number | null;
  somaLida: number | null;
  observacao: string | null;
}

/** Reduz a foto (lado maior 2000px, JPEG) para o envio ser rápido e caber no limite do servidor. */
export async function reduzirImagem(arquivo: File, ladoMax = 2000, qualidade = 0.85): Promise<Blob> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Não consegui abrir esta imagem."));
      i.src = url;
    });
    const escala = Math.min(1, ladoMax / Math.max(img.naturalWidth, img.naturalHeight));
    const largura = Math.round(img.naturalWidth * escala);
    const altura = Math.round(img.naturalHeight * escala);
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não consegui preparar a imagem.");
    ctx.drawImage(img, 0, 0, largura, altura);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Não consegui preparar a imagem."))), "image/jpeg", qualidade);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Envia UMA foto (página do relatório) e recebe as quantidades vendidas lidas, já ligadas aos itens da consignação. */
export async function lerPagina(consignacaoId: number, imagem: Blob): Promise<LeituraPagina> {
  const form = new FormData();
  form.append("imagem", imagem, "pagina.jpg");
  const { data } = await api.post<LeituraPagina>(`/consignacoes/${consignacaoId}/ler-pagina`, form, {
    timeout: 150_000,
  });
  return data;
}
