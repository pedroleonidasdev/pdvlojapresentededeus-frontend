"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, Check, ImagePlus, Loader2, RotateCcw, X } from "lucide-react";
import { Consignacao } from "@/lib/types";
import { formatarMoeda } from "@/lib/format";
import { LeituraPagina, LinhaLida, lerPagina, reduzirImagem } from "@/lib/ler-conferencia";

type EstadoArquivo = "aguardando" | "lendo" | "ok" | "erro";

interface Arquivo {
  chave: string;
  file: File;
  estado: EstadoArquivo;
  erro?: string;
  resultado?: LeituraPagina;
}

function mensagemErro(e: unknown): string {
  const resp = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
  if (resp) return resp;
  if (e instanceof Error && e.message) return e.message;
  return "Não foi possível ler esta foto.";
}

interface Props {
  consignacao: Consignacao;
  /** Recebe itemId -> quantidade vendida. Não fecha a consignação: só preenche a conferência. */
  onAplicar: (quantidades: Record<number, number>) => void;
  onFechar: () => void;
}

export default function LerConferenciaFoto({ consignacao, onAplicar, onFechar }: Props) {
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [lendo, setLendo] = useState(false);
  const [etapa, setEtapa] = useState<"fotos" | "revisar">("fotos");
  const [editadas, setEditadas] = useState<Record<number, number>>({});
  const [mostrarZerados, setMostrarZerados] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function atualizar(chave: string, parte: Partial<Arquivo>) {
    setArquivos((prev) => prev.map((a) => (a.chave === chave ? { ...a, ...parte } : a)));
  }

  function adicionar(lista: FileList | null) {
    if (!lista) return;
    const existentes = new Set(arquivos.map((a) => a.chave));
    const novos: Arquivo[] = [];
    Array.from(lista).forEach((f) => {
      if (!f.type.startsWith("image/")) return;
      const chave = `${f.name}-${f.size}-${f.lastModified}`;
      if (existentes.has(chave)) return;
      existentes.add(chave);
      novos.push({ chave, file: f, estado: "aguardando" });
    });
    setArquivos((prev) => [...prev, ...novos]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function remover(chave: string) {
    setArquivos((prev) => prev.filter((a) => a.chave !== chave));
  }

  async function lerFotos() {
    setLendo(true);
    const pendentes = arquivos.filter((a) => a.estado === "aguardando" || a.estado === "erro");
    let lidasOk = 0;
    let houveErro = false;
    for (const a of pendentes) {
      atualizar(a.chave, { estado: "lendo", erro: undefined });
      try {
        const blob = await reduzirImagem(a.file);
        const resultado = await lerPagina(consignacao.id, blob);
        atualizar(a.chave, { estado: "ok", resultado });
        lidasOk++;
      } catch (e) {
        houveErro = true;
        atualizar(a.chave, { estado: "erro", erro: mensagemErro(e) });
      }
    }
    setLendo(false);
    if (lidasOk > 0 && !houveErro) setEtapa("revisar");
  }

  const precoPorItem = useMemo(() => {
    const m = new Map<number, number>();
    consignacao.itens.forEach((i) => m.set(i.id, i.precoUnitario));
    return m;
  }, [consignacao.itens]);

  const consolidado = useMemo(() => {
    const lidas = new Map<number, { linha: LinhaLida; foto: number }>();
    const duplicadas: string[] = [];
    const naoEncontradas: string[] = [];
    const totaisDivergentes: string[] = [];
    const observacoes: string[] = [];
    arquivos.forEach((a, idx) => {
      const r = a.resultado;
      if (!r) return;
      const foto = idx + 1;
      r.linhas.forEach((l) => {
        if (lidas.has(l.itemId)) {
          duplicadas.push(`${l.produtoNome} apareceu em mais de uma foto (vale a primeira, foto ${lidas.get(l.itemId)?.foto}).`);
          return;
        }
        lidas.set(l.itemId, { linha: l, foto });
      });
      r.naoEncontradas.forEach((n) => naoEncontradas.push(`${n} (foto ${foto})`));
      if (r.totalManuscrito != null && r.somaLida != null && Math.abs(r.totalManuscrito - r.somaLida) > 0.01) {
        totaisDivergentes.push(
          `Foto ${foto}: total escrito à mão ${formatarMoeda(r.totalManuscrito)}, mas a soma dos valores lidos dá ${formatarMoeda(r.somaLida)}. Alguma linha dessa foto pode estar errada.`
        );
      }
      if (r.observacao) observacoes.push(`Foto ${foto}: ${r.observacao}`);
    });
    const semLeitura = consignacao.itens.filter((i) => !lidas.has(i.id));
    return { lidas, duplicadas, naoEncontradas, totaisDivergentes, observacoes, semLeitura };
  }, [arquivos, consignacao.itens]);

  const qtdFinal = (l: LinhaLida) => editadas[l.itemId] ?? l.qtdVendida;
  const precisaAtencao = (l: LinhaLida) => editadas[l.itemId] === undefined && l.avisos.length > 0;

  const linhasOrdenadas = useMemo(() => {
    const todas = Array.from(consolidado.lidas.values()).map((x) => x.linha);
    const visiveis = todas.filter(
      (l) => mostrarZerados || precisaAtencao(l) || (editadas[l.itemId] ?? l.qtdVendida) > 0
    );
    const peso = (l: LinhaLida) => (precisaAtencao(l) ? 0 : 1);
    return visiveis.sort((a, b) => peso(a) - peso(b) || a.produtoNome.localeCompare(b.produtoNome));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consolidado.lidas, editadas, mostrarZerados]);

  const resumo = useMemo(() => {
    let unidades = 0;
    let totalSistema = 0;
    let totalManuscrito = 0;
    let comAtencao = 0;
    let zerados = 0;
    consolidado.lidas.forEach(({ linha }, itemId) => {
      const q = editadas[itemId] ?? linha.qtdVendida;
      unidades += q;
      totalSistema += q * (precoPorItem.get(itemId) ?? 0);
      if (linha.valorLido != null) totalManuscrito += linha.valorLido;
      if (editadas[itemId] === undefined && linha.avisos.length > 0) comAtencao++;
      if (q === 0) zerados++;
    });
    return { unidades, totalSistema, totalManuscrito, comAtencao, zerados };
  }, [consolidado.lidas, editadas, precoPorItem]);

  function aplicar() {
    const q: Record<number, number> = {};
    consolidado.lidas.forEach(({ linha }, itemId) => {
      const v = editadas[itemId] ?? linha.qtdVendida;
      q[itemId] = Math.min(Math.max(Math.trunc(v) || 0, 0), linha.enviada);
    });
    onAplicar(q);
  }

  const pendentes = arquivos.filter((a) => a.estado === "aguardando" || a.estado === "erro").length;
  const algumaLida = arquivos.some((a) => a.estado === "ok");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-4 z-[60] no-print">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Camera className="w-5 h-5" /> Ler fotos do relatório
            </h3>
            <p className="text-sm text-muted">
              {etapa === "fotos"
                ? "Tire uma foto de cada página do relatório com as vendas anotadas. O sistema lê e preenche a conferência; nada é baixado do estoque agora."
                : "Confira o que foi lido. Corrija o que estiver errado e só depois aplique na conferência."}
            </p>
          </div>
          <button onClick={onFechar} className="text-muted hover:text-foreground p-1" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {etapa === "fotos" && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => adicionar(e.target.files)}
              />
              <button
                onClick={() => inputRef.current?.click()}
                disabled={lendo}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-border hover:bg-background rounded-xl py-6 text-sm font-medium transition disabled:opacity-50"
              >
                <ImagePlus className="w-5 h-5" />
                Escolher fotos ou tirar foto (pode marcar várias)
              </button>

              {arquivos.length > 0 && (
                <ul className="space-y-2">
                  {arquivos.map((a, idx) => (
                    <li key={a.chave} className="border border-border rounded-lg px-3 py-2 flex items-center gap-3">
                      <span className="text-sm font-semibold w-14 shrink-0">Foto {idx + 1}</span>
                      <span className="text-sm text-muted truncate flex-1">{a.file.name}</span>
                      {a.estado === "aguardando" && <span className="text-xs text-muted">aguardando</span>}
                      {a.estado === "lendo" && (
                        <span className="text-xs text-primary flex items-center gap-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> lendo…
                        </span>
                      )}
                      {a.estado === "ok" && (
                        <span className="text-xs text-success flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> {a.resultado?.linhas.length ?? 0} itens lidos
                        </span>
                      )}
                      {a.estado === "erro" && <span className="text-xs text-danger max-w-[50%] text-right">{a.erro}</span>}
                      {!lendo && a.estado !== "lendo" && (
                        <button onClick={() => remover(a.chave)} className="text-muted hover:text-danger" aria-label="Remover foto">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted">
                As fotos são enviadas para um serviço de leitura por IA apenas para ler os números e não ficam guardadas no sistema.
                Cada página leva alguns segundos.
              </p>
            </>
          )}

          {etapa === "revisar" && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div className="bg-background rounded-lg px-3 py-2">
                  <p className="text-xs text-muted">Itens lidos</p>
                  <p className="font-semibold">
                    {consolidado.lidas.size} de {consignacao.itens.length}
                  </p>
                </div>
                <div className="bg-background rounded-lg px-3 py-2">
                  <p className="text-xs text-muted">Unidades vendidas</p>
                  <p className="font-semibold">{resumo.unidades}</p>
                </div>
                <div className="bg-background rounded-lg px-3 py-2">
                  <p className="text-xs text-muted">Total (qtd × preço do sistema)</p>
                  <p className="font-semibold">{formatarMoeda(resumo.totalSistema)}</p>
                </div>
                <div className="bg-background rounded-lg px-3 py-2">
                  <p className="text-xs text-muted">Soma dos valores escritos à mão</p>
                  <p className="font-semibold">{formatarMoeda(resumo.totalManuscrito)}</p>
                </div>
              </div>

              {(consolidado.totaisDivergentes.length > 0 ||
                consolidado.duplicadas.length > 0 ||
                consolidado.naoEncontradas.length > 0) && (
                <div className="bg-danger-light text-danger rounded-lg px-3 py-2 text-sm space-y-1">
                  {consolidado.totaisDivergentes.map((t) => (
                    <p key={t} className="flex gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {t}
                    </p>
                  ))}
                  {consolidado.duplicadas.map((t) => (
                    <p key={t} className="flex gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {t}
                    </p>
                  ))}
                  {consolidado.naoEncontradas.length > 0 && (
                    <p className="flex gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      Linhas lidas que não são desta consignação (ignoradas): {consolidado.naoEncontradas.join("; ")}
                    </p>
                  )}
                </div>
              )}

              {consolidado.semLeitura.length > 0 && (
                <div className="bg-accent-light text-accent-dark rounded-lg px-3 py-2 text-sm">
                  <p className="font-semibold flex gap-2 items-center">
                    <AlertTriangle className="w-4 h-4" />
                    {consolidado.semLeitura.length} itens não apareceram nas fotos e ficam como estão (sem vendas lançadas).
                  </p>
                  <p className="mt-1 text-xs max-h-20 overflow-y-auto">
                    {consolidado.semLeitura.map((i) => i.produtoNome).join(" · ")}
                  </p>
                  <p className="mt-1 text-xs">Se faltou alguma página, volte, adicione a foto e leia de novo.</p>
                </div>
              )}

              {consolidado.observacoes.length > 0 && (
                <div className="bg-background rounded-lg px-3 py-2 text-xs text-muted space-y-1">
                  {consolidado.observacoes.map((o) => (
                    <p key={o}>{o}</p>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <p className="text-muted">
                  {resumo.comAtencao > 0 ? (
                    <span className="text-danger font-semibold">{resumo.comAtencao} precisam de conferência (no topo)</span>
                  ) : (
                    "Nenhum item com alerta."
                  )}
                </p>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={mostrarZerados} onChange={(e) => setMostrarZerados(e.target.checked)} />
                  Mostrar também os {resumo.zerados} com 0 vendido
                </label>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-background text-xs text-muted">
                    <tr>
                      <th className="text-left px-3 py-2">Produto</th>
                      <th className="text-right px-2 py-2">Env.</th>
                      <th className="text-right px-2 py-2">Vendida</th>
                      <th className="text-right px-3 py-2">À mão / sistema</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasOrdenadas.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-muted">
                          Nada vendido nas fotos lidas.
                        </td>
                      </tr>
                    )}
                    {linhasOrdenadas.map((l) => {
                      const q = qtdFinal(l);
                      const atencao = precisaAtencao(l);
                      return (
                        <tr key={l.itemId} className={`border-t border-border align-top ${atencao ? "bg-danger-light/40" : ""}`}>
                          <td className="px-3 py-2">
                            <p className="font-medium">{l.produtoNome}</p>
                            {atencao &&
                              l.avisos.map((a) => (
                                <p key={a} className="text-xs text-danger mt-0.5">
                                  {a}
                                </p>
                              ))}
                            {editadas[l.itemId] !== undefined && (
                              <p className="text-xs text-primary mt-0.5">Corrigido por você (lido: {l.qtdVendida})</p>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right font-mono">{l.enviada}</td>
                          <td className="px-2 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              max={l.enviada}
                              value={q}
                              onChange={(e) => {
                                const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
                                setEditadas((prev) => ({ ...prev, [l.itemId]: n }));
                              }}
                              className="w-16 border border-border rounded-md px-2 py-1 text-right font-mono bg-surface"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            <p>{l.valorLido != null ? formatarMoeda(l.valorLido) : "—"}</p>
                            <p className="text-muted">{formatarMoeda(q * (precoPorItem.get(l.itemId) ?? 0))}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-border bg-background">
          {etapa === "fotos" ? (
            <>
              <button onClick={onFechar} className="border border-border hover:bg-surface text-sm font-medium px-4 py-2 rounded-lg transition">
                Cancelar
              </button>
              <div className="flex gap-2">
                {algumaLida && !lendo && (
                  <button
                    onClick={() => setEtapa("revisar")}
                    className="border border-border hover:bg-surface text-sm font-medium px-4 py-2 rounded-lg transition"
                  >
                    Ver resultado
                  </button>
                )}
                <button
                  onClick={lerFotos}
                  disabled={lendo || pendentes === 0}
                  className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium text-sm px-5 py-2 rounded-lg transition disabled:opacity-50"
                >
                  {lendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  {lendo ? "Lendo…" : pendentes > 0 ? `Ler ${pendentes} foto${pendentes > 1 ? "s" : ""}` : "Ler fotos"}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => setEtapa("fotos")}
                className="flex items-center gap-2 border border-border hover:bg-surface text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                <RotateCcw className="w-4 h-4" /> Voltar às fotos
              </button>
              <button
                onClick={aplicar}
                disabled={consolidado.lidas.size === 0}
                className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium text-sm px-5 py-2 rounded-lg transition disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> Aplicar na conferência
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
