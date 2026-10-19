"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import api from "@/lib/api";
import type { Despesa, FormaPagamento, TipoDespesa } from "@/lib/types";
import { CATEGORIAS_DESPESA_SUGERIDAS, formatarMoeda, LABEL_FORMA_PAGAMENTO } from "@/lib/format";
import { dividirEmParcelas, hojeISO, somarDias, somarMeses } from "@/lib/financas";

const TIPOS: { id: TipoDespesa; titulo: string; ajuda: string }[] = [
  { id: "DESPESA", titulo: "Despesa", ajuda: "Conta ou custo do negócio, à vista ou parcelado." },
  { id: "SANGRIA", titulo: "Sangria", ajuda: "Dinheiro que sai do caixa, por exemplo para levar ao banco." },
  { id: "SUPRIMENTO", titulo: "Suprimento", ajuda: "Dinheiro que entra no caixa, por exemplo troco." },
];

const OPCOES_PARCELAS = [2, 3, 4, 5, 6, 10, 12];

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const CHIP = `rounded-lg border px-3 py-1.5 text-sm transition ${FOCO}`;
const CHIP_ATIVO = "border-primary bg-primary-light font-medium text-primary-dark";
const CHIP_INATIVO = "border-border text-muted hover:border-primary/40 hover:text-foreground";

function paraNumero(texto: string): number {
  return Number(texto.replace(",", ".")) || 0;
}

/** Formulário de novo lançamento ou edição. O que é enviado ao servidor não mudou. */
export default function ModalLancamento({
  despesa,
  onClose,
  onSalvo,
}: {
  despesa?: Despesa | null;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const editando = !!despesa;
  const [tipo, setTipo] = useState<TipoDespesa>(despesa?.tipo ?? "DESPESA");
  const [categoria, setCategoria] = useState(despesa?.categoria ?? "");
  const [fornecedor, setFornecedor] = useState(despesa?.fornecedor ?? "");
  const [descricao, setDescricao] = useState(despesa?.descricao ?? "");
  const [valor, setValor] = useState(despesa ? String(despesa.valor).replace(".", ",") : "");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>(despesa?.formaPagamento ?? "DINHEIRO");
  const [dataVencimento, setDataVencimento] = useState(despesa?.dataVencimento ?? "");
  const [numeroParcelas, setNumeroParcelas] = useState(
    despesa?.numeroParcelas && despesa.numeroParcelas > 1 ? String(despesa.numeroParcelas) : ""
  );
  const [parcelas, setParcelas] = useState<{ dataVencimento: string; valor: string }[]>(
    despesa?.parcelas?.length
      ? despesa.parcelas.map((p) => ({
          dataVencimento: p.dataVencimento ?? "",
          valor: String(p.valor).replace(".", ","),
        }))
      : []
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ehMovimentoCaixa = tipo !== "DESPESA";
  const valorNumero = paraNumero(valor);
  const nParcelas = Number(numeroParcelas) || 0;

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape" && !salvando) onClose();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose, salvando]);

  // Quantidade de parcelas ou total mudou: divide de novo, preservando as datas já
  // digitadas. Roda nos eventos (e não ao abrir), então editar uma compra parcelada
  // não recalcula parcelas que já tinham valores diferentes entre si.
  function recalcularParcelas(novoN: string, novoValor: string, tipoAtual: TipoDespesa) {
    const n = Number(novoN);
    if (tipoAtual !== "DESPESA" || !n || n < 2) {
      setParcelas([]);
      return;
    }
    const valores = dividirEmParcelas(paraNumero(novoValor), n);
    setParcelas((atual) => valores.map((v, i) => ({ dataVencimento: atual[i]?.dataVencimento ?? "", valor: v })));
  }

  function alterarTipo(novo: TipoDespesa) {
    setTipo(novo);
    recalcularParcelas(numeroParcelas, valor, novo);
  }

  function alterarNumeroParcelas(novo: string) {
    setNumeroParcelas(novo);
    recalcularParcelas(novo, valor, tipo);
  }

  function alterarValor(novo: string) {
    setValor(novo);
    recalcularParcelas(numeroParcelas, novo, tipo);
  }

  function atualizarParcela(index: number, campo: "dataVencimento" | "valor", novo: string) {
    setParcelas((atual) => atual.map((p, i) => (i === index ? { ...p, [campo]: novo } : p)));
  }

  function datasMesAMes() {
    const primeira = parcelas[0]?.dataVencimento;
    if (!primeira) return;
    setParcelas((atual) => atual.map((p, i) => ({ ...p, dataVencimento: somarMeses(primeira, i) })));
  }

  function dividirIgualmente() {
    const valores = dividirEmParcelas(valorNumero, parcelas.length);
    setParcelas((atual) => atual.map((p, i) => ({ ...p, valor: valores[i] })));
  }

  const somaParcelas = useMemo(() => parcelas.reduce((acc, p) => acc + paraNumero(p.valor), 0), [parcelas]);
  const somaDiverge = parcelas.length > 0 && Math.abs(somaParcelas - valorNumero) > 0.009;

  const pendencia =
    tipo === "DESPESA" && !categoria.trim()
      ? "Escolha ou digite uma categoria."
      : !descricao.trim()
        ? "Descreva o lançamento."
        : !(valorNumero > 0)
          ? "Informe um valor maior que zero."
          : null;

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const payload = {
      tipo,
      categoria: categoria.trim() || null,
      fornecedor: !ehMovimentoCaixa && fornecedor.trim() ? fornecedor.trim() : null,
      descricao: descricao.trim(),
      valor: valorNumero,
      formaPagamento: ehMovimentoCaixa ? "DINHEIRO" : formaPagamento,
      numeroParcelas: !ehMovimentoCaixa && numeroParcelas.trim() ? Number(numeroParcelas) : null,
      parcelas:
        !ehMovimentoCaixa && parcelas.length > 0
          ? parcelas.map((p) => ({ dataVencimento: p.dataVencimento || null, valor: paraNumero(p.valor) }))
          : null,
      dataVencimento: !ehMovimentoCaixa && parcelas.length === 0 && dataVencimento ? dataVencimento : null,
    };
    try {
      if (editando && despesa) {
        await api.put(`/despesas/${despesa.id}`, payload);
      } else {
        await api.post("/despesas", payload);
      }
      onSalvo();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Não foi possível salvar o lançamento. Confira os dados e tente de novo.";
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  }

  const rotulo = "mb-1.5 block text-sm font-medium";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-lancamento"
        className="flex max-h-[94vh] w-full max-w-lg flex-col rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 id="titulo-lancamento" className="text-base font-semibold">
            {editando ? "Editar lançamento" : "Novo lançamento"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className={`rounded-md p-1 text-muted hover:text-foreground ${FOCO}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-6 py-5">
          {/* tipo */}
          <div>
            <span id="rotulo-tipo" className={rotulo}>
              O que você quer registrar?
            </span>
            <div role="radiogroup" aria-labelledby="rotulo-tipo" className="grid gap-2 sm:grid-cols-3">
              {TIPOS.map((t) => {
                const ativo = tipo === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    disabled={editando}
                    onClick={() => alterarTipo(t.id)}
                    className={`rounded-lg border p-3 text-left transition ${FOCO} ${
                      ativo ? "border-primary bg-primary-light" : "border-border hover:border-primary/40"
                    } ${editando && !ativo ? "opacity-50" : ""} ${editando ? "cursor-not-allowed" : ""}`}
                  >
                    <span className={`block text-sm font-medium ${ativo ? "text-primary-dark" : ""}`}>{t.titulo}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted">{t.ajuda}</span>
                  </button>
                );
              })}
            </div>
            {editando && <p className="mt-1.5 text-xs text-muted">O tipo não pode ser mudado depois de criado.</p>}
            {ehMovimentoCaixa && !editando && (
              <p className="mt-1.5 text-xs text-muted">Sempre em dinheiro, e só pode ser lançado com o caixa aberto.</p>
            )}
          </div>

          {/* o que foi */}
          <div className="space-y-4">
            <div>
              <label htmlFor="lanc-categoria" className={rotulo}>
                Categoria {tipo !== "DESPESA" && <span className="font-normal text-muted">(opcional)</span>}
              </label>
              <input
                id="lanc-categoria"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                list="categorias-sugeridas"
                placeholder={tipo === "DESPESA" ? "Ex.: Aluguel, Energia, Fornecedor" : "Ex.: Retirada para o banco"}
                className="input"
              />
              <datalist id="categorias-sugeridas">
                {CATEGORIAS_DESPESA_SUGERIDAS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {tipo === "DESPESA" && !categoria.trim() && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CATEGORIAS_DESPESA_SUGERIDAS.slice(0, 6).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategoria(c)}
                      className={`${CHIP} ${CHIP_INATIVO} py-1 text-xs`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!ehMovimentoCaixa && (
              <div>
                <label htmlFor="lanc-fornecedor" className={rotulo}>
                  Fornecedor <span className="font-normal text-muted">(opcional)</span>
                </label>
                <input
                  id="lanc-fornecedor"
                  value={fornecedor}
                  onChange={(e) => setFornecedor(e.target.value)}
                  placeholder="Ex.: Distribuidora Central"
                  className="input"
                />
              </div>
            )}

            <div>
              <label htmlFor="lanc-descricao" className={rotulo}>
                Descrição
              </label>
              <input
                id="lanc-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder={ehMovimentoCaixa ? "Ex.: Levado ao banco" : "O que foi comprado ou pago?"}
                autoFocus
                className="input"
              />
            </div>
          </div>

          {/* quanto e como */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="lanc-valor" className={rotulo}>
                {!ehMovimentoCaixa && nParcelas >= 2 ? "Valor total" : "Valor"}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">R$</span>
                <input
                  id="lanc-valor"
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^[0-9]*[.,]?[0-9]*$/.test(v)) alterarValor(v);
                  }}
                  placeholder="0,00"
                  className="input pl-9 tabular-nums"
                />
              </div>
            </div>

            {!ehMovimentoCaixa && (
              <div>
                <label htmlFor="lanc-forma" className={rotulo}>
                  Forma de pagamento
                </label>
                <select
                  id="lanc-forma"
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento)}
                  className="input"
                >
                  {(Object.keys(LABEL_FORMA_PAGAMENTO) as FormaPagamento[]).map((f) => (
                    <option key={f} value={f}>
                      {LABEL_FORMA_PAGAMENTO[f]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {!ehMovimentoCaixa && (
            <div>
              <span id="rotulo-parcelas" className={rotulo}>
                Pagamento
              </span>
              <div role="group" aria-labelledby="rotulo-parcelas" className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  aria-pressed={nParcelas < 2}
                  onClick={() => alterarNumeroParcelas("")}
                  className={`${CHIP} ${nParcelas < 2 ? CHIP_ATIVO : CHIP_INATIVO}`}
                >
                  À vista
                </button>
                {OPCOES_PARCELAS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={nParcelas === n}
                    onClick={() => alterarNumeroParcelas(String(n))}
                    className={`${CHIP} ${nParcelas === n ? CHIP_ATIVO : CHIP_INATIVO}`}
                  >
                    {n}x
                  </button>
                ))}
                <input
                  type="number"
                  min={2}
                  step={1}
                  inputMode="numeric"
                  value={OPCOES_PARCELAS.includes(nParcelas) ? "" : numeroParcelas}
                  onChange={(e) => alterarNumeroParcelas(e.target.value)}
                  placeholder="Outro"
                  aria-label="Outra quantidade de parcelas"
                  className="input w-24 py-1.5 text-sm"
                />
              </div>
            </div>
          )}

          {/* vencimento à vista */}
          {!ehMovimentoCaixa && parcelas.length === 0 && (
            <div>
              <label htmlFor="lanc-vencimento" className={rotulo}>
                Vence em <span className="font-normal text-muted">(opcional)</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="lanc-vencimento"
                  type="date"
                  value={dataVencimento}
                  onChange={(e) => setDataVencimento(e.target.value)}
                  className="input w-44"
                />
                {(
                  [
                    ["Hoje", 0],
                    ["Em 7 dias", 7],
                    ["Em 30 dias", 30],
                  ] as const
                ).map(([nome, dias]) => (
                  <button
                    key={nome}
                    type="button"
                    onClick={() => setDataVencimento(somarDias(hojeISO(), dias))}
                    className={`${CHIP} ${CHIP_INATIVO} py-1 text-xs`}
                  >
                    {nome}
                  </button>
                ))}
                {dataVencimento && (
                  <button
                    type="button"
                    onClick={() => setDataVencimento("")}
                    className="rounded-md px-2 py-1 text-xs text-muted hover:text-foreground"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-xs text-muted">
                Sem data, a conta fica em aberto e aparece em “Sem data de vencimento”.
              </p>
            </div>
          )}

          {/* parcelas */}
          {!ehMovimentoCaixa && parcelas.length > 0 && (
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">Vencimento e valor de cada parcela</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={datasMesAMes}
                    disabled={!parcelas[0]?.dataVencimento}
                    title="Usa a data da 1ª parcela e repete no mesmo dia dos meses seguintes"
                    className={`${CHIP} ${CHIP_INATIVO} py-1 text-xs disabled:opacity-50`}
                  >
                    Datas mês a mês
                  </button>
                  <button
                    type="button"
                    onClick={dividirIgualmente}
                    className={`${CHIP} ${CHIP_INATIVO} py-1 text-xs`}
                  >
                    Dividir igualmente
                  </button>
                </div>
              </div>
              <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                {parcelas.map((p, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-8 shrink-0 text-sm text-muted">{i + 1}ª</span>
                    <input
                      type="date"
                      value={p.dataVencimento}
                      onChange={(e) => atualizarParcela(i, "dataVencimento", e.target.value)}
                      aria-label={`Vencimento da parcela ${i + 1}`}
                      className="input flex-1 py-1.5 text-sm"
                    />
                    <div className="relative w-28 shrink-0">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">R$</span>
                      <input
                        inputMode="decimal"
                        value={p.valor}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "" || /^[0-9]*[.,]?[0-9]*$/.test(v)) atualizarParcela(i, "valor", v);
                        }}
                        aria-label={`Valor da parcela ${i + 1}`}
                        className="input py-1.5 pl-8 text-sm tabular-nums"
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <p className={`mt-2 text-xs ${somaDiverge ? "text-danger" : "text-muted"}`}>
                Soma das parcelas: {formatarMoeda(somaParcelas)}
                {somaDiverge && ` — difere do valor total (${formatarMoeda(valorNumero)}). Use “Dividir igualmente” para acertar.`}
              </p>
            </div>
          )}

          {erro && (
            <div role="alert" className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">
              {erro}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          <p className="min-w-0 text-xs text-muted" aria-live="polite">
            {pendencia}
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="rounded-lg px-4 py-2 text-sm text-muted transition hover:bg-background disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando || !!pendencia}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
            >
              {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {editando ? "Salvar alterações" : "Salvar lançamento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
