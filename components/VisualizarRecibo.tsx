"use client";

import { useEffect, useRef, useState } from "react";
import { Consignacao } from "@/lib/types";
import { baixarArquivo, montarModeloConsignacao } from "@/lib/consignacao-modelo";
import { Download, ExternalLink, FileText, FileType2, Loader2, Minus, Plus, Printer, X } from "lucide-react";

const POR_FOLHA = 3;
const MAX = 99;

type Formato = "pdf" | "word";

/**
 * Visualização do(s) recibo(s) ANTES de imprimir: mesma ideia do Termo de Responsabilidade.
 * O PDF é gerado no navegador (3 recibos por folha A4, com linha tracejada para recortar)
 * e "Imprimir" imprime exatamente o que aparece aqui. Também salva em PDF ou Word.
 */
export default function VisualizarRecibo({
  consignacao,
  onFechar,
}: {
  consignacao: Consignacao;
  onFechar: () => void;
}) {
  const [quantidade, setQuantidade] = useState(1);
  const [urlPdf, setUrlPdf] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState<Formato | null>(null);
  const blobPdfRef = useRef<Blob | null>(null);
  const urlAtualRef = useRef<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const folhas = Math.ceil(quantidade / POR_FOLHA);

  // gera o PDF ao abrir e sempre que a quantidade muda (com pequena espera enquanto digita)
  useEffect(() => {
    let cancelado = false;
    const espera = setTimeout(async () => {
      try {
        const { gerarPdfRecibos } = await import("@/lib/consignacao-recibo-pdf");
        const blob = await gerarPdfRecibos(montarModeloConsignacao(consignacao), quantidade);
        if (cancelado) return;
        const nova = URL.createObjectURL(blob);
        const anterior = urlAtualRef.current;
        blobPdfRef.current = blob;
        urlAtualRef.current = nova;
        setUrlPdf(nova);
        setErro(null);
        if (anterior) setTimeout(() => URL.revokeObjectURL(anterior), 2000);
      } catch {
        if (!cancelado) setErro("Não foi possível gerar a visualização do recibo.");
      } finally {
        if (!cancelado) setAtualizando(false);
      }
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [consignacao, quantidade]);

  // libera o PDF da memória ao fechar
  useEffect(() => {
    return () => {
      if (urlAtualRef.current) URL.revokeObjectURL(urlAtualRef.current);
    };
  }, []);

  const nomeBase = montarModeloConsignacao(consignacao).nomeArquivoBase.replace(/^consignacao-/, "recibo-");

  function mudarQuantidade(v: number) {
    if (Number.isNaN(v)) return;
    setAtualizando(true);
    setQuantidade(Math.max(1, Math.min(MAX, Math.floor(v))));
  }

  async function baixar(formato: Formato) {
    setGerando(formato);
    setErro(null);
    try {
      if (formato === "pdf") {
        const blob = blobPdfRef.current;
        if (!blob) return;
        baixarArquivo(blob, `${nomeBase}.pdf`);
      } else {
        const { gerarReciboConsignacao } = await import("@/lib/consignacao-recibo");
        baixarArquivo(await gerarReciboConsignacao(montarModeloConsignacao(consignacao), quantidade), `${nomeBase}.docx`);
      }
    } catch {
      setErro(`Não foi possível gerar o arquivo ${formato === "word" ? "Word" : "PDF"}.`);
    } finally {
      setGerando(null);
    }
  }

  function imprimir() {
    try {
      const janela = iframeRef.current?.contentWindow;
      if (!janela) throw new Error("sem janela");
      janela.focus();
      janela.print();
    } catch {
      // alguns navegadores (ex: celular) não deixam imprimir de dentro do quadro:
      // abre o PDF numa aba, onde o botão de imprimir do próprio visualizador funciona
      if (urlPdf) window.open(urlPdf, "_blank");
    }
  }

  const botao =
    "flex items-center gap-2 border border-border hover:bg-background text-sm font-medium px-3 py-2 rounded-lg transition disabled:opacity-50";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-6 z-[70] no-print">
      <div className="bg-surface rounded-2xl w-full max-w-5xl h-[94vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 className="font-semibold text-sm truncate">Recibo — {consignacao.consignatario}</h2>
            <p className="text-xs text-muted mt-0.5">
              Confira antes de imprimir. Saem {POR_FOLHA} recibos por folha A4, com linha tracejada para recortar.
            </p>
          </div>
          <button onClick={onFechar} className="p-1 rounded-md hover:bg-background text-muted shrink-0" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <label htmlFor="qtd-recibos" className="text-sm font-medium">
              Quantidade de recibos
            </label>
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => mudarQuantidade(quantidade - 1)}
                disabled={quantidade <= 1}
                className="px-2.5 py-2 hover:bg-background disabled:opacity-40"
                aria-label="Diminuir quantidade"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                id="qtd-recibos"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX}
                value={quantidade}
                onChange={(e) => mudarQuantidade(Number(e.target.value))}
                className="w-14 text-center text-sm py-2 bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => mudarQuantidade(quantidade + 1)}
                disabled={quantidade >= MAX}
                className="px-2.5 py-2 hover:bg-background disabled:opacity-40"
                aria-label="Aumentar quantidade"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <span className="text-xs text-muted">
              = {folhas} {folhas === 1 ? "folha" : "folhas"} A4
            </span>
          </div>

          <button
            onClick={imprimir}
            disabled={!urlPdf || atualizando}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium text-sm px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          <span className="text-xs text-muted mx-1 hidden sm:inline">
            <Download className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
            Salvar como:
          </span>
          <button onClick={() => baixar("pdf")} disabled={!urlPdf || atualizando || gerando !== null} className={botao}>
            {gerando === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-danger" />}
            PDF
          </button>
          <button onClick={() => baixar("word")} disabled={gerando !== null} className={botao}>
            {gerando === "word" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileType2 className="w-4 h-4 text-blue-600" />}
            Word
          </button>
          {urlPdf && (
            <a href={urlPdf} target="_blank" rel="noreferrer" className={`${botao} ml-auto`}>
              <ExternalLink className="w-4 h-4" />
              Abrir em outra aba
            </a>
          )}
        </div>

        <div className="flex-1 min-h-0 bg-background relative">
          {erro ? (
            <p className="text-sm text-danger p-6">{erro}</p>
          ) : !urlPdf ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <iframe
                ref={iframeRef}
                src={`${urlPdf}#view=FitH`}
                title="Visualização do recibo"
                className="w-full h-full border-0"
              />
              {atualizando && (
                <div className="absolute top-3 right-4 flex items-center gap-2 text-xs bg-surface border border-border rounded-full px-3 py-1 shadow-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Atualizando…
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
