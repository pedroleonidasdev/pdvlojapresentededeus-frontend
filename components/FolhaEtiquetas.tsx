"use client";

import { useEffect, useMemo, useState } from "react";
import { Produto } from "@/lib/types";
import { formatarMoeda } from "@/lib/format";
import BarcodeSvg from "@/components/BarcodeSvg";
import { X, Printer, Loader2, CheckCircle2, Ruler, ChevronDown, Minus, Plus } from "lucide-react";

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

// mesmo limite aplicado no goldensky_core.py (MAX_ETIQUETAS_POR_LOTE) — replicado
// aqui só para avisar o usuário antes de tentar enviar, evitando um erro 422 seco.
const MAX_ETIQUETAS_POR_LOTE = 100;
const QUANTIDADE_MIN = 1;
const QUANTIDADE_MAX = 99;

/**
 * Tela de etiquetas para impressão: cada produto selecionado vira uma etiqueta
 * (nome + preço + código de barras), repetida pela quantidade escolhida — a
 * mesma quantidade vale igualmente para todos os produtos selecionados. A
 * pré-visualização abaixo é só para conferência — o botão envia os dados para
 * o agente local goldensky-agente.py, que imprime direto na impressora térmica
 * Goldensky-80 (fila CUPS), respeitando o tamanho da etiqueta (ajustável
 * abaixo) e o espaçamento de 4mm entre elas.
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

  // quantidade de etiquetas por produto — vale igualmente para todos os
  // produtos selecionados (ex: 3 produtos × quantidade 5 = 15 etiquetas)
  const [quantidade, setQuantidade] = useState(QUANTIDADE_MIN);

  const totalEtiquetas = useMemo(
    () => comCodigo.length * quantidade,
    [comCodigo.length, quantidade]
  );
  const excedeuLimite = totalEtiquetas > MAX_ETIQUETAS_POR_LOTE;

  function definirQuantidade(valor: number) {
    setQuantidade(Math.min(QUANTIDADE_MAX, Math.max(QUANTIDADE_MIN, valor)));
  }

  function handleQuantidadeInput(valor: string) {
    if (valor === "") {
      setQuantidade(QUANTIDADE_MIN);
      return;
    }
    const numero = Number(valor.replace(/\D/g, ""));
    if (!Number.isNaN(numero)) definirQuantidade(numero);
  }

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

      // repete cada produto no lote pela mesma quantidade escolhida — o
      // agente/core só entende "uma etiqueta por item da lista", então a
      // multiplicação é feita aqui antes de montar o payload.
      const etiquetas = comCodigo.flatMap((produto) =>
        Array.from({ length: quantidade }, () => ({
          nome: produto.nome,
          precoVenda: produto.precoVenda,
          codigoBarras: produto.codigoBarras,
        }))
      );

      const payload = {
        etiquetas,
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
            Etiquetas para impressão ({totalEtiquetas})
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

        <div className="px-5 pt-3 space-y-3">
          <div>
            <label className="block text-[11px] text-muted mb-1">
              Quantidade por produto{comCodigo.length > 1 ? ` (aplicada aos ${comCodigo.length} selecionados)` : ""}
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => definirQuantidade(quantidade - 1)}
                disabled={quantidade <= QUANTIDADE_MIN}
                className="w-8 h-8 flex items-center justify-center rounded-md border border-border hover:bg-background text-muted disabled:opacity-40 disabled:hover:bg-transparent transition"
                aria-label="Diminuir quantidade"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                inputMode="numeric"
                value={quantidade}
                onChange={(e) => handleQuantidadeInput(e.target.value)}
                className="w-14 text-center text-sm py-1.5 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                aria-label="Quantidade de etiquetas por produto"
              />
              <button
                type="button"
                onClick={() => definirQuantidade(quantidade + 1)}
                disabled={quantidade >= QUANTIDADE_MAX}
                className="w-8 h-8 flex items-center justify-center rounded-md border border-border hover:bg-background text-muted disabled:opacity-40 disabled:hover:bg-transparent transition"
                aria-label="Aumentar quantidade"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div>
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
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {comCodigo.length > 0 ? (
            <>
              <div className="max-w-[220px] mx-auto text-center border border-dashed border-border rounded-lg py-3">
                <p className="text-[11px] font-medium leading-tight px-1">{comCodigo[0].nome}</p>
                <p className="text-[11px] font-mono">{formatarMoeda(comCodigo[0].precoVenda)}</p>
                <BarcodeSvg
                  valor={comCodigo[0].codigoBarras!}
                  altura={20}
                  largura={0.8}
                  fontSize={9}
                  className="mx-auto mt-0.5"
                />
              </div>
              <p className="text-[11px] text-muted text-center mt-3">
                Pré-visualização de 1 etiqueta como exemplo — {comCodigo.length > 1 ? "os outros produtos seguem" : "as demais cópias seguem"} o
                mesmo modelo. {quantidade > 1 && `Cada produto será impresso ${quantidade}× conforme a quantidade acima.`}
              </p>

              {comCodigo.length > 1 && (
                <ul className="mt-3 space-y-1">
                  {comCodigo.map((produto) => (
                    <li
                      key={produto.id}
                      className="flex items-center justify-between gap-3 text-xs border border-border rounded-lg px-3 py-1.5"
                    >
                      <span className="truncate">{produto.nome}</span>
                      <span className="text-muted shrink-0">{quantidade}×</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-sm text-muted text-center py-6">Nenhum produto com código de barras selecionado.</p>
          )}
        </div>

        <div className="p-4 border-t border-border space-y-2">
          {erro && <div className="rounded-lg bg-danger-light text-danger text-sm px-3 py-2">{erro}</div>}

          {excedeuLimite && !enviadoComSucesso && (
            <div className="rounded-lg bg-danger-light text-danger text-xs px-3 py-2">
              O lote aceita no máximo {MAX_ETIQUETAS_POR_LOTE} etiquetas por impressão — reduza a
              quantidade, selecione menos produtos, ou imprima em duas vezes.
            </div>
          )}

          {enviadoComSucesso ? (
            <div className="w-full flex items-center justify-center gap-2 bg-primary-light text-primary-dark font-medium py-2.5 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
              Etiquetas enviadas para a Goldensky.
            </div>
          ) : (
            <button
              onClick={enviarParaImpressora}
              disabled={comCodigo.length === 0 || enviando || excedeuLimite}
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
                  Imprimir {totalEtiquetas} etiqueta{totalEtiquetas === 1 ? "" : "s"}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
