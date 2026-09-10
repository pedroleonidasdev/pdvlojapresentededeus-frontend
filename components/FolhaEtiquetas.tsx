"use client";

import { useEffect, useState } from "react";
import { Produto } from "@/lib/types";
import { formatarMoeda } from "@/lib/format";
import BarcodeSvg from "@/components/BarcodeSvg";
import { X, Printer, Loader2, CheckCircle2, Ruler, ChevronDown } from "lucide-react";

// O agente de impressão roda no mesmo computador da loja que tem a impressora
// Goldensky conectada — o navegador chama ele DIRETO em localhost, sem passar
// pelo backend na nuvem (que não tem como acessar uma impressora USB local).
// Navegadores tratam http://localhost como contexto seguro mesmo estando o
// site em HTTPS, então essa chamada funciona normalmente em produção,
// desde que o PDV seja usado no computador que tem a impressora instalada.
const AGENTE_IMPRESSORA_URL =
  process.env.NEXT_PUBLIC_GOLDENSKY_AGENTE_URL ?? "http://localhost:9100/imprimir-etiquetas";

// Dimensão física do lote de etiquetas em uso — fica salva no navegador desse
// computador, já que costuma ser sempre a mesma até trocar de lote/rolo.
const CHAVE_LARGURA = "goldensky_etiqueta_largura_mm";
const CHAVE_ALTURA = "goldensky_etiqueta_altura_mm";
const LARGURA_PADRAO = "60";
const ALTURA_PADRAO = "30";

/**
 * Tela de etiquetas para impressão: cada produto selecionado vira uma etiqueta
 * (nome + preço + código de barras). A pré-visualização abaixo é só para
 * conferência — o botão envia os dados para o agente local goldensky-agente.py,
 * que imprime direto na impressora térmica Goldensky-80 (fila CUPS), respeitando
 * o tamanho da etiqueta (ajustável abaixo) e o espaçamento de 4mm entre elas.
 */
export default function FolhaEtiquetas({
  produtos,
  onFechar,
}: {
  produtos: Produto[];
  onFechar: () => void;
}) {
  const comCodigo = produtos.filter((p) => p.codigoBarras);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviadoComSucesso, setEnviadoComSucesso] = useState(false);

  const [mostrarDimensao, setMostrarDimensao] = useState(false);
  const [largura, setLargura] = useState(LARGURA_PADRAO);
  const [altura, setAltura] = useState(ALTURA_PADRAO);

  // carrega a última dimensão usada nesse computador (se houver)
  useEffect(() => {
    const larguraSalva = localStorage.getItem(CHAVE_LARGURA);
    const alturaSalva = localStorage.getItem(CHAVE_ALTURA);
    if (larguraSalva) setLargura(larguraSalva);
    if (alturaSalva) setAltura(alturaSalva);
  }, []);

  function handleDimensaoChange(valor: string, setter: (v: string) => void) {
    if (valor === "" || /^[0-9]*[.,]?[0-9]*$/.test(valor)) setter(valor);
  }

  async function enviarParaImpressora() {
    setEnviando(true);
    setErro(null);
    try {
      const larguraNum = Number(largura.replace(",", ".")) || Number(LARGURA_PADRAO);
      const alturaNum = Number(altura.replace(",", ".")) || Number(ALTURA_PADRAO);

      const payload = {
        etiquetas: comCodigo.map((produto) => ({
          nome: produto.nome,
          precoVenda: produto.precoVenda,
          codigoBarras: produto.codigoBarras,
        })),
        largura: larguraNum,
        altura: alturaNum,
      };

      const resposta = await fetch(AGENTE_IMPRESSORA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const dados = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        throw new Error(dados?.mensagem ?? "Não foi possível imprimir as etiquetas.");
      }

      // deu certo com essa dimensão — guarda pra próxima vez
      localStorage.setItem(CHAVE_LARGURA, String(larguraNum));
      localStorage.setItem(CHAVE_ALTURA, String(alturaNum));

      setEnviadoComSucesso(true);
      setTimeout(() => {
        onFechar();
      }, 1500);
    } catch (e: unknown) {
      const msg = e instanceof Error && e.message.includes("fetch")
        ? "Não foi possível conectar ao agente de impressão neste computador. " +
          "Verifique se o serviço goldensky-agente está rodando " +
          "(sudo systemctl status goldensky-agente)."
        : e instanceof Error
          ? e.message
          : "Não foi possível imprimir as etiquetas.";
      setErro(msg);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-sm">
            Etiquetas para impressão ({comCodigo.length})
          </h2>
          <button onClick={onFechar} className="p-1 rounded-md hover:bg-background text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {comCodigo.length < produtos.length && (
          <p className="text-xs text-muted px-5 pt-3">
            {produtos.length - comCodigo.length} produto(s) selecionado(s) ainda não têm código
            de barras e não vão aparecer aqui. Use &quot;Gerar códigos faltantes&quot; primeiro.
          </p>
        )}

        <div className="px-5 pt-3">
          <button
            type="button"
            onClick={() => setMostrarDimensao((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition"
          >
            <Ruler className="w-3.5 h-3.5" />
            Tamanho da etiqueta: {largura} × {altura} mm
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${mostrarDimensao ? "rotate-180" : ""}`} />
          </button>

          {mostrarDimensao && (
            <div className="flex items-end gap-3 mt-2 mb-1">
              <div>
                <label className="block text-[11px] text-muted mb-1">Largura (mm)</label>
                <input
                  inputMode="decimal"
                  value={largura}
                  onChange={(e) => handleDimensaoChange(e.target.value, setLargura)}
                  className="w-20 px-2 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                />
              </div>
              <span className="text-muted text-sm pb-1.5">×</span>
              <div>
                <label className="block text-[11px] text-muted mb-1">Altura (mm)</label>
                <input
                  inputMode="decimal"
                  value={altura}
                  onChange={(e) => handleDimensaoChange(e.target.value, setAltura)}
                  className="w-20 px-2 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                />
              </div>
              <p className="text-[11px] text-muted pb-1.5">
                Fica salvo neste computador para a próxima impressão.
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {comCodigo.map((produto) => (
              <div key={produto.id} className="text-center border-b border-dashed border-border pb-2 last:border-0">
                <p className="text-[11px] font-medium leading-tight px-1">{produto.nome}</p>
                <p className="text-[11px] font-mono">{formatarMoeda(produto.precoVenda)}</p>
                <BarcodeSvg
                  valor={produto.codigoBarras!}
                  altura={28}
                  largura={1.2}
                  fontSize={9}
                  className="mx-auto mt-0.5"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-border space-y-2">
          {erro && <div className="rounded-lg bg-danger-light text-danger text-sm px-3 py-2">{erro}</div>}

          {enviadoComSucesso ? (
            <div className="w-full flex items-center justify-center gap-2 bg-primary-light text-primary-dark font-medium py-2.5 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
              Etiquetas enviadas para a Goldensky.
            </div>
          ) : (
            <button
              onClick={enviarParaImpressora}
              disabled={comCodigo.length === 0 || enviando}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {enviando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando para a impressora...
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  Imprimir {comCodigo.length} etiqueta{comCodigo.length === 1 ? "" : "s"}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
