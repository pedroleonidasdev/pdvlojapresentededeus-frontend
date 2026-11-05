"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Produto } from "@/lib/types";
import { formatarMoeda } from "@/lib/format";
import BarcodeSvg from "@/components/BarcodeSvg";
import PreviewEtiquetaZpl from "@/components/PreviewEtiquetaZpl";
import {
  EtiquetaParaImprimir,
  PERFIL_ELGIN,
  PerfilImpressoraEtiquetas,
  consultarImpressoraEtiquetas,
  imprimirEtiquetas,
} from "@/lib/impressora";
import {
  X,
  Printer,
  Loader2,
  CheckCircle2,
  Ruler,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  RefreshCw,
} from "lucide-react";

// O agente de impressão roda no mesmo computador da loja que tem a impressora
// conectada — o navegador chama ele DIRETO em localhost, sem passar pelo
// backend na nuvem (que não tem como acessar uma impressora USB local).
// Navegadores tratam http://localhost como contexto seguro mesmo estando o
// site em HTTPS, então essa chamada funciona normalmente em produção,
// desde que o PDV seja usado no computador que tem a impressora instalada.
// A URL e a comunicação ficam em lib/impressora.ts.

// Dimensão física do lote de etiquetas em uso — fica salva no navegador desse
// computador, separada por impressora (rolos e larguras máximas são diferentes).
// As chaves da Goldensky são as originais, para não perder o que já foi salvo.
const CHAVES_DIMENSAO = {
  escpos: { largura: "goldensky_etiqueta_largura_mm", altura: "goldensky_etiqueta_altura_mm" },
  zpl: { largura: "elgin_l42_etiqueta_largura_mm", altura: "elgin_l42_etiqueta_altura_mm" },
} as const;
// bobina dupla da loja: 2 etiquetas de 40 x 25 mm lado a lado
const CHAVE_COLUNAS = "elgin_l42_etiqueta_colunas";
const CHAVE_GAP_COLUNAS = "elgin_l42_etiqueta_gap_colunas_mm";
const LARGURA_PADRAO = "40";
const ALTURA_PADRAO = "25";
const COLUNAS_PADRAO = 2;
const GAP_COLUNAS_PADRAO = "3";

// limites de sanidade — os mesmos do backend (goldensky_core.py), replicados aqui
// só para avisar antes de enviar, evitando um erro 422 seco.
const LARGURA_MIN_MM = 20;
const ALTURA_MIN_MM = 10;
const ALTURA_MAX_MM = 150;

// Goldensky: o front repete os itens, então o lote inteiro (já multiplicado) vale 100.
const MAX_ETIQUETAS_POR_LOTE = 100;
// Elgin: a impressora repete sozinha (^PQ), então o limite é de produtos por envio
// (100) e um teto total de segurança para não gastar a bobina por engano.
const MAX_PRODUTOS_POR_ENVIO_ZPL = 100;
const MAX_ETIQUETAS_TOTAL_ZPL = 500;

const QUANTIDADE_MIN = 1;
const QUANTIDADE_MAX = 99;

// tamanhos de etiqueta mais comuns — atalhos para não digitar
const TAMANHOS_PRONTOS = [
  { largura: 40, altura: 25 },
  { largura: 60, altura: 30 },
  { largura: 50, altura: 30 },
  { largura: 100, altura: 50 },
];

function paraNumero(texto: string, padrao: string): number {
  return Number(texto.replace(",", ".")) || Number(padrao);
}

/**
 * Tela de etiquetas para impressão: cada produto selecionado vira uma etiqueta
 * (nome + preço + código de barras), com seleção e quantidade individuais.
 *
 * Funciona com as duas impressoras da loja. A tela pergunta ao agente local
 * qual está em uso (lib/impressora.ts):
 *  - Elgin/Bematech L42 Pro Full (ZPL): pré-visualização fiel ao que a
 *    impressora desenha, até 108 mm de largura, repetição feita pela própria impressora;
 *  - Goldensky 80mm (ESC/POS): comportamento original.
 * A pré-visualização é só para conferência — o botão envia os dados ao agente.
 */
export default function FolhaEtiquetas({
  produtos,
  onFechar,
}: {
  produtos: Produto[];
  onFechar: () => void;
}) {
  const comCodigo = produtos.filter((p) => p.codigoBarras);

  // undefined = verificando; null = agente não respondeu; objeto = impressora em uso
  const [perfil, setPerfil] = useState<PerfilImpressoraEtiquetas | null | undefined>(undefined);
  const impressora = perfil ?? PERFIL_ELGIN;
  const ehZpl = impressora.driver === "zpl";

  const [enviando, setEnviando] = useState<"lote" | "teste" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviadoComSucesso, setEnviadoComSucesso] = useState(false);

  const [mostrarDimensao, setMostrarDimensao] = useState(false);
  const [largura, setLargura] = useState(LARGURA_PADRAO);
  const [altura, setAltura] = useState(ALTURA_PADRAO);
  // etiquetas lado a lado na bobina (2 = bobina dupla) e espaço entre elas
  const [colunas, setColunas] = useState(COLUNAS_PADRAO);
  const [gapColunas, setGapColunas] = useState(GAP_COLUNAS_PADRAO);

  // Cada produto tem seleção e quantidade próprias.
  const [configuracoesProdutos, setConfiguracoesProdutos] = useState<
    Record<number, { selecionado: boolean; quantidade: number }>
  >({});

  useEffect(() => {
    setConfiguracoesProdutos((atuais) => {
      const novas: typeof atuais = {};
      for (const produto of comCodigo) {
        novas[produto.id] = atuais[produto.id] ?? {
          selecionado: true,
          quantidade: QUANTIDADE_MIN,
        };
      }
      return novas;
    });
  }, [produtos]);

  const produtosSelecionados = comCodigo.filter(
    (produto) => configuracoesProdutos[produto.id]?.selecionado
  );

  function atualizarProduto(
    id: number,
    alteracao: Partial<{ selecionado: boolean; quantidade: number }>
  ) {
    setConfiguracoesProdutos((atuais) => ({
      ...atuais,
      [id]: {
        selecionado: atuais[id]?.selecionado ?? true,
        quantidade: atuais[id]?.quantidade ?? QUANTIDADE_MIN,
        ...alteracao,
      },
    }));
  }

  function definirQuantidadeProduto(id: number, valor: number) {
    atualizarProduto(id, {
      quantidade: Math.min(QUANTIDADE_MAX, Math.max(QUANTIDADE_MIN, valor)),
    });
  }

  function handleQuantidadeProduto(id: number, valor: string) {
    if (valor === "") {
      atualizarProduto(id, { quantidade: 0 });
      return;
    }

    const numero = Number(valor.replace(/\D/g, ""));
    if (!Number.isNaN(numero)) {
      definirQuantidadeProduto(id, numero);
    }
  }

  // qual produto aparece na pré-visualização
  const [indicePreview, setIndicePreview] = useState(0);
  const indiceAtual = Math.min(indicePreview, Math.max(0, comCodigo.length - 1));
  const produtoPreview = comCodigo[indiceAtual];

  const verificarImpressora = useCallback(async () => {
    setPerfil(undefined);
    setPerfil(await consultarImpressoraEtiquetas());
  }, []);

  useEffect(() => {
    verificarImpressora();
  }, [verificarImpressora]);

  // carrega a última dimensão usada nesse computador para a impressora em uso
  useEffect(() => {
    const chaves = CHAVES_DIMENSAO[impressora.driver];
    setLargura(localStorage.getItem(chaves.largura) ?? LARGURA_PADRAO);
    setAltura(localStorage.getItem(chaves.altura) ?? ALTURA_PADRAO);
    setColunas(Number(localStorage.getItem(CHAVE_COLUNAS)) || COLUNAS_PADRAO);
    setGapColunas(localStorage.getItem(CHAVE_GAP_COLUNAS) ?? GAP_COLUNAS_PADRAO);
  }, [impressora.driver]);

  const larguraNum = paraNumero(largura, LARGURA_PADRAO);
  const alturaNum = paraNumero(altura, ALTURA_PADRAO);
  const colunasEfetivas = ehZpl ? colunas : 1;
  const gapNum = paraNumero(gapColunas, GAP_COLUNAS_PADRAO);
  const larguraLinhaMm = colunasEfetivas * larguraNum + (colunasEfetivas - 1) * gapNum;

  const erroDimensao = useMemo(() => {
    if (larguraNum < LARGURA_MIN_MM || larguraNum > impressora.larguraMaxMm) {
      return `A largura deve ficar entre ${LARGURA_MIN_MM} e ${impressora.larguraMaxMm} mm (${impressora.nome}).`;
    }
    if (alturaNum < ALTURA_MIN_MM || alturaNum > ALTURA_MAX_MM) {
      return `A altura deve ficar entre ${ALTURA_MIN_MM} e ${ALTURA_MAX_MM} mm.`;
    }
    if (larguraLinhaMm > impressora.larguraMaxMm) {
      return `${colunasEfetivas} colunas de ${larguraNum} mm + espaços = ${larguraLinhaMm} mm; a ${impressora.nome} imprime no máximo ${impressora.larguraMaxMm} mm.`;
    }
    return null;
  }, [larguraNum, alturaNum, larguraLinhaMm, colunasEfetivas, impressora.larguraMaxMm, impressora.nome]);

  const totalEtiquetas = useMemo(
    () => produtosSelecionados.reduce(
      (total, produto) => total + (configuracoesProdutos[produto.id]?.quantidade ?? 1),
      0
    ),
    [produtosSelecionados, configuracoesProdutos]
  );

  const mensagemLimite = useMemo(() => {
    if (ehZpl) {
      if (produtosSelecionados.length > MAX_PRODUTOS_POR_ENVIO_ZPL) {
        return `Cada impressão aceita no máximo ${MAX_PRODUTOS_POR_ENVIO_ZPL} produtos — selecione menos produtos ou imprima em duas vezes.`;
      }
      if (totalEtiquetas > MAX_ETIQUETAS_TOTAL_ZPL) {
        return `Cada impressão aceita no máximo ${MAX_ETIQUETAS_TOTAL_ZPL} etiquetas no total — reduza a quantidade ou imprima em duas vezes.`;
      }
      return null;
    }
    if (totalEtiquetas > MAX_ETIQUETAS_POR_LOTE) {
      return `O lote aceita no máximo ${MAX_ETIQUETAS_POR_LOTE} etiquetas por impressão — reduza a quantidade, selecione menos produtos, ou imprima em duas vezes.`;
    }
    return null;
  }, [ehZpl, produtosSelecionados.length, totalEtiquetas]);

  function handleDimensaoChange(valor: string, setter: (v: string) => void) {
    if (valor === "" || /^[0-9]*[.,]?[0-9]*$/.test(valor)) setter(valor);
  }

  function escolherTamanho(l: number, a: number) {
    setLargura(String(l));
    setAltura(String(a));
  }

  async function enviarParaImpressora(modo: "lote" | "teste") {
    setEnviando(modo);
    setErro(null);
    try {
      let etiquetas: EtiquetaParaImprimir[];
      if (modo === "teste") {
        // 1 etiqueta só, do produto que está na pré-visualização
        etiquetas = [
          {
            nome: produtoPreview.nome,
            precoVenda: produtoPreview.precoVenda,
            codigoBarras: produtoPreview.codigoBarras!,
            ...(impressora.suportaQuantidade ? { quantidade: 1 } : {}),
          },
        ];
      } else if (impressora.suportaQuantidade) {
        // a própria impressora repete (^PQ): 1 item por produto, com a quantidade
        etiquetas = produtosSelecionados.map((produto) => ({
          nome: produto.nome,
          precoVenda: produto.precoVenda,
          codigoBarras: produto.codigoBarras!,
          quantidade: configuracoesProdutos[produto.id]?.quantidade ?? 1,
        }));
      } else {
        // o agente só entende "uma etiqueta por item da lista", então a
        // multiplicação é feita aqui antes de montar o payload.
        etiquetas = produtosSelecionados.flatMap((produto) =>
          Array.from(
            { length: configuracoesProdutos[produto.id]?.quantidade ?? 1 },
            () => ({
              nome: produto.nome,
              precoVenda: produto.precoVenda,
              codigoBarras: produto.codigoBarras!,
            })
          )
        );
      }

      await imprimirEtiquetas({
        etiquetas,
        largura: larguraNum,
        altura: alturaNum,
        ...(ehZpl ? { colunas: colunasEfetivas, espacamentoColunas: gapNum } : {}),
      });

      // deu certo com essa dimensão — guarda pra próxima vez
      const chaves = CHAVES_DIMENSAO[impressora.driver];
      localStorage.setItem(chaves.largura, String(larguraNum));
      localStorage.setItem(chaves.altura, String(alturaNum));
      if (ehZpl) {
        localStorage.setItem(CHAVE_COLUNAS, String(colunasEfetivas));
        localStorage.setItem(CHAVE_GAP_COLUNAS, String(gapNum));
      }

      if (modo === "teste") {
        // teste não fecha a tela: dá pra conferir a etiqueta impressa e imprimir o lote
        return;
      }
      setEnviadoComSucesso(true);
      setTimeout(() => {
        onFechar();
      }, 1500);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Não foi possível imprimir as etiquetas.");
    } finally {
      setEnviando(null);
    }
  }

  const agenteOffline = perfil === null;
  const bloqueado =
    produtosSelecionados.length === 0 || enviando !== null || !!mensagemLimite || !!erroDimensao || agenteOffline;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <h2 className="font-semibold text-sm">Etiquetas para impressão ({totalEtiquetas})</h2>
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              {perfil === undefined && (
                <span className="inline-flex items-center gap-1 text-muted">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Verificando impressora...
                </span>
              )}
              {perfil === null && (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-light text-danger px-2 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                    Agente de impressão offline
                  </span>
                  <button
                    type="button"
                    onClick={verificarImpressora}
                    className="inline-flex items-center gap-1 text-muted hover:text-foreground transition"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Verificar de novo
                  </button>
                </>
              )}
              {perfil && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success-light text-success px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  {perfil.nome}
                </span>
              )}
            </div>
          </div>
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
          <div className="rounded-lg border border-border bg-background px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">Produtos para imprimir</span>
              <span className="text-[11px] text-muted tabular-nums">
                {produtosSelecionados.length} selecionado(s) · {totalEtiquetas} etiqueta(s)
              </span>
            </div>
            <p className="text-[10px] text-muted mt-1">
              Marque os produtos e defina quantas etiquetas deseja de cada um.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setMostrarDimensao((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition"
            >
              <Ruler className="w-3.5 h-3.5" />
              Tamanho da etiqueta: {largura} × {altura} mm{colunasEfetivas > 1 ? ` · ${colunasEfetivas} colunas` : ""}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${mostrarDimensao ? "rotate-180" : ""}`} />
            </button>

            {mostrarDimensao && (
              <div className="mt-2 mb-1 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {TAMANHOS_PRONTOS.filter((t) => t.largura <= impressora.larguraMaxMm).map((t) => {
                    const ativo = larguraNum === t.largura && alturaNum === t.altura;
                    return (
                      <button
                        key={`${t.largura}x${t.altura}`}
                        type="button"
                        onClick={() => escolherTamanho(t.largura, t.altura)}
                        className={`text-[11px] px-2 py-1 rounded-full border transition ${
                          ativo
                            ? "bg-primary text-white border-primary"
                            : "border-border text-muted hover:bg-background hover:text-foreground"
                        }`}
                      >
                        {t.largura} × {t.altura}
                      </button>
                    );
                  })}
                </div>

                {ehZpl && (
                  <div className="flex items-end gap-3">
                    <div>
                      <label className="block text-[11px] text-muted mb-1">Etiquetas lado a lado</label>
                      <div className="flex gap-1.5">
                        {[1, 2, 3].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setColunas(n)}
                            className={`text-[11px] px-3 py-1 rounded-full border transition ${
                              colunas === n
                                ? "bg-primary text-white border-primary"
                                : "border-border text-muted hover:bg-background hover:text-foreground"
                            }`}
                          >
                            {n === 1 ? "1 (bobina simples)" : n === 2 ? "2 (bobina dupla)" : "3"}
                          </button>
                        ))}
                      </div>
                    </div>
                    {colunas > 1 && (
                      <div>
                        <label className="block text-[11px] text-muted mb-1">Espaço entre colunas (mm)</label>
                        <input
                          inputMode="decimal"
                          value={gapColunas}
                          onChange={(e) => handleDimensaoChange(e.target.value, setGapColunas)}
                          className="w-20 px-2 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-end gap-3">
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

                {erroDimensao && <p className="text-[11px] text-danger">{erroDimensao}</p>}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {produtoPreview ? (
            <>
              {comCodigo.length > 1 && (
                <div className="flex items-center justify-center gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => setIndicePreview(Math.max(0, indiceAtual - 1))}
                    disabled={indiceAtual === 0}
                    className="w-7 h-7 flex items-center justify-center rounded-md border border-border hover:bg-background text-muted disabled:opacity-40 disabled:hover:bg-transparent transition"
                    aria-label="Etiqueta anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[11px] text-muted tabular-nums">
                    Produto {indiceAtual + 1} de {comCodigo.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIndicePreview(Math.min(comCodigo.length - 1, indiceAtual + 1))}
                    disabled={indiceAtual >= comCodigo.length - 1}
                    className="w-7 h-7 flex items-center justify-center rounded-md border border-border hover:bg-background text-muted disabled:opacity-40 disabled:hover:bg-transparent transition"
                    aria-label="Próxima etiqueta"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {ehZpl && !erroDimensao ? (
                <PreviewEtiquetaZpl
                  nome={produtoPreview.nome}
                  preco={produtoPreview.precoVenda}
                  codigo={produtoPreview.codigoBarras!}
                  larguraMm={larguraNum}
                  alturaMm={alturaNum}
                />
              ) : (
                <div className="max-w-[220px] mx-auto text-center border border-dashed border-border rounded-lg px-2 pt-3 pb-1">
                  <p className="text-[10px] font-medium leading-[1.05] px-1">{produtoPreview.nome}</p>
                  <p className="text-[11px] font-mono leading-none mt-0.5">{formatarMoeda(produtoPreview.precoVenda)}</p>
                  <BarcodeSvg
                    valor={produtoPreview.codigoBarras!}
                    altura={15}
                    largura={0.8}
                    fontSize={8}
                    className="mx-auto mt-0"
                  />
                </div>
              )}

              <p className="text-[11px] text-muted text-center mt-3">
                {comCodigo.length > 1
                  ? "Pré-visualização do produto escolhido acima — os outros seguem o mesmo modelo."
                  : "Pré-visualização da etiqueta — as demais cópias seguem o mesmo modelo."}{" "}
                A quantidade de cada produto é definida individualmente na lista abaixo.
              </p>

              {ehZpl && (
                <p className="text-[11px] text-muted text-center mt-1">
                  Etiquetas saindo deslocadas? Confira o tamanho acima e recalibre a mídia na impressora
                  (veja o manual da Elgin).
                </p>
              )}

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Selecionar produtos</span>
                  <button
                    type="button"
                    onClick={() => {
                      setConfiguracoesProdutos((atuais) => {
                        const novas = { ...atuais };
                        for (const produto of comCodigo) {
                          novas[produto.id] = {
                            selecionado: true,
                            quantidade: atuais[produto.id]?.quantidade ?? 1,
                          };
                        }
                        return novas;
                      });
                    }}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Marcar todos
                  </button>
                </div>

                {comCodigo.map((produto, i) => {
                  const config = configuracoesProdutos[produto.id] ?? {
                    selecionado: true,
                    quantidade: 1,
                  };

                  return (
                    <div
                      key={produto.id}
                      className={`rounded-lg border p-2 transition ${
                        config.selecionado
                          ? "border-primary/50 bg-primary-soft"
                          : "border-border opacity-70"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={config.selecionado}
                          onChange={(e) => atualizarProduto(produto.id, {
                            selecionado: e.target.checked,
                          })}
                          className="w-4 h-4 accent-current shrink-0"
                          aria-label={`Selecionar ${produto.nome}`}
                        />

                        <button
                          type="button"
                          onClick={() => setIndicePreview(i)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <span className="block text-xs font-medium truncate">
                            {produto.nome}
                          </span>
                          <span className="block text-[10px] text-muted">
                            {formatarMoeda(produto.precoVenda)}
                            {i === indiceAtual ? " · Pré-visualizando" : ""}
                          </span>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => definirQuantidadeProduto(produto.id, config.quantidade - 1)}
                            disabled={!config.selecionado || config.quantidade <= QUANTIDADE_MIN}
                            className="w-7 h-7 flex items-center justify-center rounded border border-border disabled:opacity-30"
                            aria-label={`Diminuir quantidade de ${produto.nome}`}
                          >
                            <Minus className="w-3 h-3" />
                          </button>

                          <input
                            type="number"
                            min={QUANTIDADE_MIN}
                            max={QUANTIDADE_MAX}
                            value={config.quantidade}
                            disabled={!config.selecionado}
                            onChange={(e) => handleQuantidadeProduto(produto.id, e.target.value)}
                            onBlur={() => {
                              if (config.quantidade < QUANTIDADE_MIN) {
                                definirQuantidadeProduto(produto.id, QUANTIDADE_MIN);
                              }
                            }}
                            className="w-11 h-7 text-center text-xs rounded border border-border bg-background disabled:opacity-40"
                            aria-label={`Quantidade de etiquetas para ${produto.nome}`}
                          />

                          <button
                            type="button"
                            onClick={() => definirQuantidadeProduto(produto.id, config.quantidade + 1)}
                            disabled={!config.selecionado || config.quantidade >= QUANTIDADE_MAX}
                            className="w-7 h-7 flex items-center justify-center rounded border border-border disabled:opacity-30"
                            aria-label={`Aumentar quantidade de ${produto.nome}`}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted text-center py-6">Nenhum produto com código de barras selecionado.</p>
          )}
        </div>

        <div className="p-4 border-t border-border space-y-2">
          {erro && <div className="rounded-lg bg-danger-light text-danger text-sm px-3 py-2">{erro}</div>}

          {mensagemLimite && !enviadoComSucesso && (
            <div className="rounded-lg bg-danger-light text-danger text-xs px-3 py-2">{mensagemLimite}</div>
          )}

          {enviadoComSucesso ? (
            <div className="w-full flex items-center justify-center gap-2 bg-primary-light text-primary-dark font-medium py-2.5 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
              Etiquetas enviadas para a {impressora.nome}.
            </div>
          ) : (
            <>
              <button
                onClick={() => enviarParaImpressora("lote")}
                disabled={bloqueado}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50"
              >
                {enviando === "lote" ? (
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

              {ehZpl && comCodigo.length > 0 && (
                <button
                  onClick={() => enviarParaImpressora("teste")}
                  disabled={bloqueado}
                  className="w-full flex items-center justify-center gap-2 border border-border hover:bg-background text-foreground text-xs font-medium py-2 rounded-lg transition disabled:opacity-50"
                >
                  {enviando === "teste" ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Enviando teste...
                    </>
                  ) : (
                    "Imprimir só 1 etiqueta de teste"
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
