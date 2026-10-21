"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Download, File, FileArchive, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { categoriaDoArquivo, ehImagemAnexo, formatarTamanho, lerMetaAnexo } from "@/lib/anexos";

interface Props {
  mensagemId: number;
  texto: string;
  minha: boolean;
}

const ICONES = {
  texto: FileText,
  planilha: FileSpreadsheet,
  compactado: FileArchive,
  audio: FileAudio,
  video: FileVideo,
  imagem: FileImage,
  outro: File,
} as const;

const MSG_EXPIRADO = "Arquivo expirado. Os anexos ficam disponíveis por 7 dias.";

/**
 * Anexo de uma mensagem. Imagens (PNG, JPEG, GIF, WebP) aparecem em miniatura; qualquer outro
 * arquivo vira um cartão com botão de baixar. O arquivo é buscado com o token do login (um link
 * comum não o envia) e NUNCA é aberto dentro do sistema, só baixado, para que nada executável rode aqui.
 */
export default function MensagemArquivo({ mensagemId, texto, minha }: Props) {
  const meta = lerMetaAnexo(texto);
  const imagem = !!meta && ehImagemAnexo(meta.mime);
  const [url, setUrl] = useState<string | null>(null);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "expirado" | "erro">(imagem ? "carregando" : "pronto");
  const [baixando, setBaixando] = useState(false);
  const [erroDownload, setErroDownload] = useState<string | null>(null);

  // miniatura: só imagens são baixadas automaticamente
  useEffect(() => {
    if (!imagem) return;
    let cancelado = false;
    let objeto: string | null = null;
    (async () => {
      try {
        const { data } = await api.get<Blob>(`/suporte/anexos/${mensagemId}`, { responseType: "blob" });
        if (cancelado) return;
        objeto = URL.createObjectURL(data);
        setUrl(objeto);
        setEstado("pronto");
      } catch (e) {
        if (cancelado) return;
        setEstado(axios.isAxiosError(e) && e.response?.status === 404 ? "expirado" : "erro");
      }
    })();
    return () => {
      cancelado = true;
      if (objeto) URL.revokeObjectURL(objeto);
    };
  }, [mensagemId, imagem]);

  if (!meta) {
    return <p className="text-xs italic opacity-80">Anexo indisponível.</p>;
  }

  async function baixar() {
    if (!meta || baixando) return;
    setBaixando(true);
    setErroDownload(null);
    try {
      const { data } = await api.get<Blob>(`/suporte/anexos/${mensagemId}`, { responseType: "blob" });
      const objeto = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = objeto;
      a.download = meta.nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objeto), 10_000);
    } catch (e) {
      setErroDownload(axios.isAxiosError(e) && e.response?.status === 404 ? MSG_EXPIRADO : "Não foi possível baixar o arquivo.");
    } finally {
      setBaixando(false);
    }
  }

  const corTexto = minha ? "text-white/80" : "text-muted";

  if (imagem) {
    return (
      <div className="space-y-1">
        {estado === "carregando" && (
          <div className="flex h-24 w-40 items-center justify-center rounded-lg bg-black/10">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {estado === "pronto" && url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={meta.nome}
            onClick={() => window.open(url, "_blank", "noopener")}
            title="Clique para abrir em tamanho grande"
            className="max-h-52 max-w-full cursor-zoom-in rounded-lg object-contain"
          />
        )}
        {estado === "expirado" && <p className="text-xs italic opacity-80">{MSG_EXPIRADO}</p>}
        {estado === "erro" && <p className="text-xs italic opacity-80">Não foi possível carregar a imagem.</p>}
        <div className={`flex items-center gap-2 text-[11px] ${corTexto}`}>
          <span className="min-w-0 flex-1 truncate">{meta.nome}</span>
          <span className="shrink-0">{formatarTamanho(meta.tamanho)}</span>
          {estado === "pronto" && (
            <button onClick={() => void baixar()} disabled={baixando} aria-label="Baixar imagem" title="Baixar" className="shrink-0 hover:opacity-70">
              {baixando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>
    );
  }

  const Icone = ICONES[categoriaDoArquivo(meta.nome)];

  return (
    <div className="space-y-1">
      <button
        onClick={() => void baixar()}
        disabled={baixando}
        title={`Baixar ${meta.nome}`}
        className={`flex w-full min-w-[11rem] items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
          minha ? "bg-white/15 hover:bg-white/25" : "bg-background hover:bg-surface-alt"
        }`}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            minha ? "bg-white/20 text-white" : "bg-primary-light text-primary"
          }`}
        >
          <Icone className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-all text-sm font-medium leading-tight line-clamp-2">{meta.nome}</span>
          <span className={`block text-[11px] ${corTexto}`}>{formatarTamanho(meta.tamanho)} · toque para baixar</span>
        </span>
        {baixando ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Download className="h-4 w-4 shrink-0" />}
      </button>
      {erroDownload && <p className="text-[11px] italic opacity-90">{erroDownload}</p>}
    </div>
  );
}
