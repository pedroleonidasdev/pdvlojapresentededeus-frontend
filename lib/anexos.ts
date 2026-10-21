/** Anexos do chat de suporte: dados de exibição guardados no texto da mensagem (JSON {n, t, m}). */

/** Tamanho máximo por arquivo (igual ao do servidor, que é quem de fato decide). */
export const MAX_ANEXO_MB = 5;
export const MAX_ANEXO_BYTES = MAX_ANEXO_MB * 1024 * 1024;

/** Só estes tipos viram miniatura; qualquer outro arquivo é sempre um download. */
const IMAGENS = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export interface AnexoMeta {
  nome: string;
  tamanho: number;
  mime: string;
}

export function lerMetaAnexo(texto: string): AnexoMeta | null {
  try {
    const o = JSON.parse(texto) as { n?: unknown; t?: unknown; m?: unknown };
    if (typeof o.n !== "string" || !o.n) return null;
    return {
      nome: o.n,
      tamanho: typeof o.t === "number" ? o.t : 0,
      mime: typeof o.m === "string" ? o.m : "application/octet-stream",
    };
  } catch {
    return null;
  }
}

export function ehImagemAnexo(mime: string): boolean {
  return IMAGENS.has(mime);
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0).replace(".", ",")} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export type CategoriaArquivo = "texto" | "planilha" | "compactado" | "audio" | "video" | "imagem" | "outro";

/** Categoria só para escolher o ícone, a partir da extensão do nome. */
export function categoriaDoArquivo(nome: string): CategoriaArquivo {
  const ext = nome.includes(".") ? nome.split(".").pop()!.toLowerCase() : "";
  if (["pdf", "doc", "docx", "odt", "txt", "rtf", "md", "ppt", "pptx", "odp"].includes(ext)) return "texto";
  if (["xls", "xlsx", "csv", "ods", "tsv"].includes(ext)) return "planilha";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "compactado";
  if (["mp3", "wav", "ogg", "m4a", "aac", "opus"].includes(ext)) return "audio";
  if (["mp4", "mov", "avi", "mkv", "webm", "3gp"].includes(ext)) return "video";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "heic"].includes(ext)) return "imagem";
  return "outro";
}
