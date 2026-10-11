"use client";

import { useEffect, useRef, useState } from "react";
import { Consignacao } from "@/lib/types";
import { baixarArquivo, montarModeloConsignacao } from "@/lib/consignacao-modelo";
import { FileSpreadsheet, FileText, FileType2, Loader2, Printer, Receipt, X, ExternalLink } from "lucide-react";

type Formato = "pdf" | "excel" | "word" | "recibo";

/**
 * Visualização do Termo + Relatório da consignação ANTES de imprimir.
 * O PDF é gerado no navegador e mostrado aqui; "Imprimir" imprime exatamente esse PDF
 * (o que se vê é o que sai no papel). Os botões também salvam em PDF, Excel ou Word.
 */
export default function VisualizarConsignacao({
  consignacao,
  onFechar,
}: {
  consignacao: Consignacao;
  onFechar: () => void;
}) {
  const [urlPdf, setUrlPdf] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState<Formato | null>(null);
  const blobPdfRef = useRef<Blob | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // gera o PDF uma vez ao abrir (e de novo se os dados da consignação mudarem)
  useEffect(() => {
    let cancelado = false;
    let urlCriada: string | null = null;
    (async () => {
      try {
        const { gerarPdfConsignacao } = await import("@/lib/consignacao-pdf");
        const blob = await gerarPdfConsignacao(montarModeloConsignacao(consignacao));
        if (cancelado) return;
        blobPdfRef.current = blob;
        urlCriada = URL.createObjectURL(blob);
        setUrlPdf(urlCriada);
        setErro(null);
      } catch {
        if (!cancelado) setErro("Não foi possível gerar a visualização do documento.");
      }
    })();
    return () => {
      cancelado = true;
      if (urlCriada) URL.revokeObjectURL(urlCriada);
    };
  }, [consignacao]);

  const nomeBase = montarModeloConsignacao(consignacao).nomeArquivoBase;

  async function baixar(formato: Formato) {
    setGerando(formato);
    setErro(null);
    try {
      const modelo = montarModeloConsignacao(consignacao);
      if (formato === "pdf") {
        const blob = blobPdfRef.current;
        if (!blob) return;
        baixarArquivo(blob, `${nomeBase}.pdf`);
      } else if (formato === "excel") {
        const { gerarExcelConsignacao } = await import("@/lib/consignacao-excel");
        baixarArquivo(await gerarExcelConsignacao(modelo), `${nomeBase}.xlsx`);
      } else if (formato === "recibo") {
        const { gerarReciboConsignacao } = await import("@/lib/consignacao-recibo");
        baixarArquivo(await gerarReciboConsignacao(modelo), `recibo-${nomeBase.replace(/^consignacao-/, "")}.docx`);
      } else {
        const { gerarWordConsignacao } = await import("@/lib/consignacao-word");
        baixarArquivo(await gerarWordConsignacao(modelo), `${nomeBase}.docx`);
      }
    } catch {
      setErro(`Não foi possível gerar o arquivo ${formato === "excel" ? "Excel" : formato === "word" ? "Word" : formato === "recibo" ? "do recibo" : "PDF"}.`);
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-6 z-[60] no-print">
      <div className="bg-surface rounded-2xl w-full max-w-5xl h-[94vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 className="font-semibold text-sm truncate">Visualização — {consignacao.consignatario}</h2>
            <p className="text-xs text-muted mt-0.5">
              Confira o documento (termo + relatório) antes de imprimir ou salvar.
            </p>
          </div>
          <button onClick={onFechar} className="p-1 rounded-md hover:bg-background text-muted shrink-0" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-border shrink-0">
          <button
            onClick={imprimir}
            disabled={!urlPdf}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium text-sm px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          <span className="text-xs text-muted mx-1 hidden sm:inline">Salvar como:</span>
          <button onClick={() => baixar("pdf")} disabled={!urlPdf || gerando !== null} className={botao}>
            {gerando === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-danger" />}
            PDF
          </button>
          <button onClick={() => baixar("excel")} disabled={gerando !== null} className={botao}>
            {gerando === "excel" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 text-primary" />}
            Excel
          </button>
          <button onClick={() => baixar("word")} disabled={gerando !== null} className={botao}>
            {gerando === "word" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileType2 className="w-4 h-4 text-blue-600" />}
            Word
          </button>
          <button onClick={() => baixar("recibo")} disabled={gerando !== null} className={botao}>
            {gerando === "recibo" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4 text-orange-600" />}
            Gerar recibo
          </button>
          {urlPdf && (
            <a href={urlPdf} target="_blank" rel="noreferrer" className={`${botao} ml-auto`}>
              <ExternalLink className="w-4 h-4" />
              Abrir em outra aba
            </a>
          )}
        </div>

        <div className="flex-1 min-h-0 bg-background">
          {erro ? (
            <p className="text-sm text-danger p-6">{erro}</p>
          ) : !urlPdf ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={`${urlPdf}#view=FitH`}
              title="Visualização do documento"
              className="w-full h-full border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}
