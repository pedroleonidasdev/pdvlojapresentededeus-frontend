"use client";

import { useEffect, useRef, useState } from "react";
import { baixarArquivo } from "@/lib/consignacao-modelo";
import {
  folhasNecessarias,
  MAXIMO_RECIBOS,
  nomeArquivoRecibo,
  RECIBOS_POR_FOLHA,
  valorParaRecibo,
} from "@/lib/consignacao-recibo";
import { ExternalLink, FileText, FileType2, Loader2, Minus, Plus, Printer, X } from "lucide-react";

type Formato = "pdf" | "word";

/**
 * Recibo da consignação: 3 por folha A4, com pontilhado para cortar. Mostra o PDF antes de
 * imprimir (o que se vê é o que sai no papel). O arquivo salvo tem exatamente o nome do consignatário.
 *
 * valorLiquidoLoja só vem em consignação já fechada; nas abertas o valor ainda não existe,
 * então a linha "R$ ____" sai em branco para preencher à mão.
 */
export default function ReciboConsignacao({
  consignatario,
  valorLiquidoLoja = null,
  onFechar,
}: {
  consignatario: string;
  valorLiquidoLoja?: number | null;
  onFechar: () => void;
}) {
  const [quantidade, setQuantidade] = useState(3);
  const [textoQuantidade, setTextoQuantidade] = useState("3");
  const [preencherValor, setPreencherValor] = useState(false);
  const [urlPdf, setUrlPdf] = useState<string | null>(null);
  // para qual quantidade/valor o PDF mostrado foi gerado (evita imprimir/baixar um PDF desatualizado)
  const [geradoPara, setGeradoPara] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState<Formato | null>(null);
  const blobPdfRef = useRef<Blob | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const valor = preencherValor && valorLiquidoLoja !== null ? valorLiquidoLoja : null;
  const chave = `${consignatario}|${valor}|${quantidade}`;
  const pronto = urlPdf !== null && geradoPara === chave;
  const folhas = folhasNecessarias(quantidade);
  const nomeBase = nomeArquivoRecibo(consignatario);

  function definirQuantidade(n: number) {
    const v = Math.min(Math.max(Math.floor(n) || 1, 1), MAXIMO_RECIBOS);
    setQuantidade(v);
    setTextoQuantidade(String(v));
  }

  // gera o PDF ao abrir e de novo (após uma pequena pausa) quando a quantidade ou o valor mudam
  useEffect(() => {
    let cancelado = false;
    let urlCriada: string | null = null;
    const espera = setTimeout(async () => {
      try {
        const { gerarPdfRecibos } = await import("@/lib/consignacao-recibo");
        const blob = await gerarPdfRecibos({ consignatario, valor }, quantidade);
        if (cancelado) return;
        blobPdfRef.current = blob;
        urlCriada = URL.createObjectURL(blob);
        setUrlPdf(urlCriada);
        setGeradoPara(chave);
        setErro(null);
      } catch {
        if (!cancelado) setErro("Não foi possível gerar a visualização do recibo.");
      }
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(espera);
      if (urlCriada) URL.revokeObjectURL(urlCriada);
    };
  }, [consignatario, valor, quantidade, chave]);

  async function baixar(formato: Formato) {
    setGerando(formato);
    setErro(null);
    try {
      if (formato === "pdf") {
        const blob = blobPdfRef.current;
        if (!blob) return;
        baixarArquivo(blob, `${nomeBase}.pdf`);
      } else {
        const { gerarWordRecibos } = await import("@/lib/consignacao-recibo");
        baixarArquivo(await gerarWordRecibos({ consignatario, valor }, quantidade), `${nomeBase}.docx`);
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
            <h2 className="font-semibold text-sm truncate">Recibo — {consignatario}</h2>
            <p className="text-xs text-muted mt-0.5">
              {RECIBOS_POR_FOLHA} recibos por folha A4, com pontilhado para cortar. Confira antes de imprimir.
            </p>
          </div>
          <button onClick={onFechar} className="p-1 rounded-md hover:bg-background text-muted shrink-0" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Quantidade de recibos</span>
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => definirQuantidade(quantidade - 1)}
                disabled={quantidade <= 1}
                className="px-2.5 py-2 hover:bg-background disabled:opacity-40"
                aria-label="Diminuir quantidade"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="text"
                inputMode="numeric"
                value={textoQuantidade}
                onChange={(e) => {
                  const digitos = e.target.value.replace(/\D/g, "").slice(0, 2);
                  setTextoQuantidade(digitos);
                  if (digitos !== "") setQuantidade(Math.min(Math.max(parseInt(digitos, 10), 1), MAXIMO_RECIBOS));
                }}
                onBlur={() => definirQuantidade(parseInt(textoQuantidade, 10))}
                className="w-12 text-center text-sm font-mono font-semibold bg-transparent outline-none py-2"
                aria-label="Quantidade de recibos"
              />
              <button
                type="button"
                onClick={() => definirQuantidade(quantidade + 1)}
                disabled={quantidade >= MAXIMO_RECIBOS}
                className="px-2.5 py-2 hover:bg-background disabled:opacity-40"
                aria-label="Aumentar quantidade"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <span className="text-xs text-muted">
              = {folhas} {folhas === 1 ? "folha A4" : "folhas A4"}
            </span>
          </div>

          {valorLiquidoLoja !== null && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary"
                checked={preencherValor}
                onChange={(e) => setPreencherValor(e.target.checked)}
              />
              Preencher o valor ({valorParaRecibo(valorLiquidoLoja)} · líquido para a loja)
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-border shrink-0">
          <button
            onClick={imprimir}
            disabled={!pronto}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium text-sm px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          <span className="text-xs text-muted mx-1 hidden sm:inline">Salvar como:</span>
          <button onClick={() => baixar("pdf")} disabled={!pronto || gerando !== null} className={botao}>
            {gerando === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-danger" />}
            PDF
          </button>
          <button onClick={() => baixar("word")} disabled={gerando !== null} className={botao}>
            {gerando === "word" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileType2 className="w-4 h-4 text-blue-600" />}
            Word
          </button>
          {pronto && (
            <a href={urlPdf} target="_blank" rel="noreferrer" className={`${botao} ml-auto`}>
              <ExternalLink className="w-4 h-4" />
              Abrir em outra aba
            </a>
          )}
        </div>

        <div className="flex-1 min-h-0 bg-background">
          {erro ? (
            <p className="text-sm text-danger p-6">{erro}</p>
          ) : !pronto ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={`${urlPdf}#view=FitH`}
              title="Visualização do recibo"
              className="w-full h-full border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}
