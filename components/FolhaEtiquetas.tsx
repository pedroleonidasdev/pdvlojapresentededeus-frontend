"use client";

import { useState } from "react";
import { Produto } from "@/lib/types";
import { formatarMoeda } from "@/lib/format";
import BarcodeSvg from "@/components/BarcodeSvg";
import { X, Printer, Loader2, CheckCircle2 } from "lucide-react";

// O agente de impressão roda no mesmo computador da loja que tem a impressora
// Goldensky conectada — o navegador chama ele DIRETO em localhost, sem passar
// pelo backend na nuvem (que não tem como acessar uma impressora USB local).
// Navegadores tratam http://localhost como contexto seguro mesmo estando o
// site em HTTPS, então essa chamada funciona normalmente em produção,
// desde que o PDV seja usado no computador que tem a impressora instalada.
const AGENTE_IMPRESSORA_URL =
  process.env.NEXT_PUBLIC_GOLDENSKY_AGENTE_URL ?? "http://localhost:9100/imprimir-etiquetas";

/**
 * Tela de etiquetas para impressão: cada produto selecionado vira uma etiqueta
 * (nome + preço + código de barras). A pré-visualização abaixo é só para
 * conferência — o botão envia os dados para o agente local goldensky-agente.py,
 * que imprime direto na impressora térmica Goldensky-80 (fila CUPS), respeitando
 * o tamanho físico da etiqueta de 60x30mm e o espaçamento de 8mm entre elas.
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

  async function enviarParaImpressora() {
    setEnviando(true);
    setErro(null);
    try {
      const payload = {
        etiquetas: comCodigo.map((produto) => ({
          nome: produto.nome,
          precoVenda: produto.precoVenda,
          codigoBarras: produto.codigoBarras,
        })),
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

      setEnviadoComSucesso(true);
      setTimeout(() => {
        onFechar();
      }, 1500);
    } catch {
      setErro(
        "Não foi possível conectar ao agente de impressão neste computador. " +
          "Verifique se o serviço goldensky-agente está rodando " +
          "(sudo systemctl status goldensky-agente)."
      );
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

        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-3">
            {comCodigo.map((produto) => (
              <div key={produto.id} className="text-center border-b border-dashed border-border pb-3 last:border-0">
                <p className="text-xs font-medium leading-tight px-1">{produto.nome}</p>
                <p className="text-xs font-mono">{formatarMoeda(produto.precoVenda)}</p>
                <BarcodeSvg valor={produto.codigoBarras!} className="mx-auto mt-1" />
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
