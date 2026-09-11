"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Caixa } from "@/lib/types";
import { formatarMoeda, formatarDataHora } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import PageHeader from "@/components/PageHeader";
import ConfirmarFechamentoCaixaModal from "@/components/ConfirmarFechamentoCaixaModal";
import { Loader2, Unlock, Lock, User, Clock, CheckCircle2, Vault, AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Tela simples de fechamento de caixa para o operador: ele informa quanto tem
 * fisicamente em caixa e confirma. De propósito, essa tela NÃO mostra o
 * faturamento do dia nem qualquer comparativo — só o ADMIN vê isso, em
 * Relatórios. O operador fecha o caixa "às cegas", sem precisar saber quanto
 * deveria ter.
 *
 * Quando não há caixa aberto, um ADMIN também pode reabrir por aqui o último
 * caixa fechado (ex.: fechou por engano, ou esqueceu de lançar uma venda
 * antes de fechar). O backend só permite reabrir o caixa fechado mais
 * recente, então não é preciso escolher qual — só confirmar.
 */
export default function FecharCaixaPage() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === "ADMIN";

  const [caixa, setCaixa] = useState<Caixa | null | undefined>(undefined);
  const [valorFinal, setValorFinal] = useState("");
  const [fechando, setFechando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [fechadoComSucesso, setFechadoComSucesso] = useState(false);
  // exige um passo de confirmação explícito antes de mandar pro backend,
  // pra reduzir o erro comum de digitar o faturamento em vez do dinheiro contado
  const [confirmando, setConfirmando] = useState(false);

  // último caixa fechado, buscado só quando não há nenhum aberto e o usuário é
  // ADMIN — é o único que a tela oferece pra reabertura, por regra do backend.
  const [ultimoFechado, setUltimoFechado] = useState<Caixa | null | undefined>(undefined);
  const [confirmandoReabertura, setConfirmandoReabertura] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const [erroReabertura, setErroReabertura] = useState<string | null>(null);

  async function carregar() {
    try {
      const { data, status } = await api.get<Caixa>("/caixa/atual");
      setCaixa(status === 204 || !data || !("id" in data) ? null : data);
    } catch {
      setCaixa(null);
    }
  }

  async function carregarUltimoFechado() {
    if (!isAdmin) return;
    try {
      const fim = new Date().toISOString().slice(0, 19);
      const inicio = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19);
      const { data } = await api.get<Caixa[]>("/caixa", { params: { inicio, fim } });
      // a lista vem ordenada da abertura mais recente pra mais antiga; o primeiro
      // item já fechado é o único elegível pra reabertura.
      const fechado = data.find((c) => !c.aberto) ?? null;
      setUltimoFechado(fechado);
    } catch {
      setUltimoFechado(null);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    if (caixa === null) {
      carregarUltimoFechado();
    } else {
      setUltimoFechado(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caixa, isAdmin]);

  async function fecharCaixa() {
    setFechando(true);
    setErro(null);
    try {
      await api.post("/caixa/fechar", {
        valorFinal: Number(valorFinal.replace(",", ".")) || 0,
      });
      setFechadoComSucesso(true);
      setCaixa(null);
      setValorFinal("");
      setConfirmando(false);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Não foi possível fechar o caixa.";
      setErro(msg);
    } finally {
      setFechando(false);
    }
  }

  async function reabrirCaixa() {
    if (!ultimoFechado) return;
    setReabrindo(true);
    setErroReabertura(null);
    try {
      const { data } = await api.post<Caixa>(`/caixa/${ultimoFechado.id}/reabrir`);
      setCaixa(data);
      setUltimoFechado(undefined);
      setFechadoComSucesso(false);
      setConfirmandoReabertura(false);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Não foi possível reabrir o caixa.";
      setErroReabertura(msg);
    } finally {
      setReabrindo(false);
    }
  }

  return (
    <div>
      <PageHeader title="Fechar Caixa" subtitle="Conte o dinheiro físico em caixa e confirme o fechamento" />

      <div className="p-4 md:p-8 max-w-lg space-y-4">
        {caixa === undefined ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : fechadoComSucesso ? (
          <div className="bg-surface border border-border rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Caixa fechado com sucesso!</p>
              <p className="text-sm text-muted mt-1">
                Já pode encerrar o expediente. Para abrir um novo caixa, vá até a tela de Venda.
              </p>
            </div>
          </div>
        ) : caixa === null ? (
          <>
            <div className="bg-surface border border-border rounded-xl p-6 text-center">
              <Vault className="w-8 h-8 mx-auto mb-2 text-muted opacity-50" />
              <p className="text-sm text-muted">Nenhum caixa aberto no momento.</p>
            </div>

            {/* reabertura: só aparece pra ADMIN, e só quando há um caixa fechado elegível */}
            {isAdmin && ultimoFechado === undefined && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted" />
              </div>
            )}

            {isAdmin && ultimoFechado && (
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 bg-secondary-light px-5 py-4">
                  <div className="w-9 h-9 rounded-lg bg-secondary text-white flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-secondary-dark/80 uppercase tracking-wide font-medium">
                      Último caixa fechado
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-secondary-dark/90 mt-0.5">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        Fechado por {ultimoFechado.usuarioFechamentoNome ?? "—"}
                      </span>
                      {ultimoFechado.dataFechamento && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatarDataHora(ultimoFechado.dataFechamento)}
                        </span>
                      )}
                      {ultimoFechado.valorFinal !== null && (
                        <span>Valor contado: {formatarMoeda(ultimoFechado.valorFinal)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  <p className="text-xs text-muted">
                    Reabrir devolve esse caixa ao estado aberto (com o mesmo valor inicial e
                    histórico de abertura). Use se ele foi fechado por engano ou se faltou
                    lançar alguma venda antes do fechamento.
                  </p>

                  {erroReabertura && (
                    <div className="rounded-lg bg-danger-light text-danger text-sm px-3 py-2">
                      {erroReabertura}
                    </div>
                  )}

                  {!confirmandoReabertura ? (
                    <button
                      onClick={() => setConfirmandoReabertura(true)}
                      className="w-full flex items-center justify-center gap-2 bg-secondary hover:bg-secondary-dark text-white text-sm font-medium py-2.5 rounded-lg transition"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reabrir este caixa
                    </button>
                  ) : (
                    <div className="rounded-lg border border-secondary/30 bg-secondary-light/60 p-3 space-y-2.5">
                      <p className="text-xs text-secondary-dark flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        Confirma a reabertura deste caixa? O fechamento atual será desfeito.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmandoReabertura(false)}
                          disabled={reabrindo}
                          className="flex-1 py-2 rounded-lg border border-border text-sm text-muted hover:bg-background transition disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={reabrirCaixa}
                          disabled={reabrindo}
                          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-secondary hover:bg-secondary-dark text-white text-sm font-medium transition disabled:opacity-50"
                        >
                          {reabrindo && <Loader2 className="w-4 h-4 animate-spin" />}
                          Confirmar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 bg-primary-light px-5 py-4">
              <div className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center shrink-0">
                <Unlock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-primary-dark/70 uppercase tracking-wide font-medium">
                  Caixa aberto
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-primary-dark/80 mt-0.5">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Aberto por {caixa.usuarioAberturaNome}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatarDataHora(caixa.dataAbertura)}
                  </span>
                  <span>Valor inicial: {formatarMoeda(caixa.valorInicial)}</span>
                </div>
                {caixa.usuarioReaberturaNome && caixa.dataReabertura && (
                  <p className="text-[11px] text-primary-dark/60 mt-1 flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" />
                    Reaberto por {caixa.usuarioReaberturaNome} em {formatarDataHora(caixa.dataReabertura)}
                  </p>
                )}
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex gap-2 rounded-lg bg-danger-light text-danger text-xs px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  Conte <strong>apenas o dinheiro em espécie</strong> (cédulas e moedas) que está na
                  gaveta agora. Não é o faturamento do dia — vendas em PIX, cartão de crédito e cartão
                  de débito não entram aqui.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">
                  Quanto tem fisicamente (em espécie) em caixa agora?
                </label>
                <input
                  inputMode="decimal"
                  value={valorFinal}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^[0-9]*[.,]?[0-9]*$/.test(v)) setValorFinal(v);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && valorFinal !== "" && setConfirmando(true)}
                  placeholder="R$ 0,00"
                  className="input w-full text-lg font-mono"
                  autoFocus
                />
              </div>

              {erro && <div className="rounded-lg bg-danger-light text-danger text-sm px-3 py-2">{erro}</div>}

              <button
                onClick={() => setConfirmando(true)}
                disabled={fechando || valorFinal === ""}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium py-2.5 rounded-lg transition disabled:opacity-50"
              >
                {fechando && <Loader2 className="w-4 h-4 animate-spin" />}
                Fechar caixa
              </button>
            </div>
          </div>
        )}
      </div>

      {confirmando && (
        <ConfirmarFechamentoCaixaModal
          valor={Number(valorFinal.replace(",", ".")) || 0}
          confirmando={fechando}
          erro={erro}
          onCancelar={() => setConfirmando(false)}
          onConfirmar={fecharCaixa}
        />
      )}
    </div>
  );
}
