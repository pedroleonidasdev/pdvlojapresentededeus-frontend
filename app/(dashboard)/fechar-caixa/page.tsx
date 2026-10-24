"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { avisarCaixaMudou } from "@/lib/caixa-eventos";
import { Caixa } from "@/lib/types";
import { formatarMoeda, formatarDataHora } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import ConfirmarFechamentoCaixaModal from "@/components/ConfirmarFechamentoCaixaModal";
import EditarAberturaCaixa from "@/components/EditarAberturaCaixa";
import { Loader2, Unlock, User, Clock, CheckCircle2, Vault, AlertTriangle } from "lucide-react";
import { CarregandoSecao } from "@/components/CarregamentoCatolico";
import { BOTAO_PRIMARIO, CARTAO, Aviso, EstadoVazio } from "@/components/ui";

/**
 * Tela simples de fechamento de caixa para o operador: ele informa quanto tem
 * fisicamente em caixa e confirma. De propósito, essa tela NÃO mostra o
 * faturamento do dia nem qualquer comparativo — só o ADMIN vê isso, em
 * Relatórios. O operador fecha o caixa "às cegas", sem precisar saber quanto
 * deveria ter.
 *
 * Reabrir um caixa fechado por engano é feito pelo ADMIN, na tela Reabrir Caixa.
 */
export default function FecharCaixaPage() {
  const [caixa, setCaixa] = useState<Caixa | null | undefined>(undefined);
  const [valorFinal, setValorFinal] = useState("");
  const [fechando, setFechando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [fechadoComSucesso, setFechadoComSucesso] = useState(false);
  // exige um passo de confirmação explícito antes de mandar pro backend,
  // pra reduzir o erro comum de digitar o faturamento em vez do dinheiro contado
  const [confirmando, setConfirmando] = useState(false);

  async function carregar() {
    try {
      const { data, status } = await api.get<Caixa>("/caixa/atual");
      setCaixa(status === 204 || !data || !("id" in data) ? null : data);
    } catch {
      setCaixa(null);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function fecharCaixa() {
    setFechando(true);
    setErro(null);
    try {
      await api.post("/caixa/fechar", {
        valorFinal: Number(valorFinal.replace(",", ".")) || 0,
      });
      avisarCaixaMudou();
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

  return (
    <div>
      <PageHeader title="Fechar Caixa" subtitle="Conte o dinheiro físico em caixa e confirme o fechamento" />

      <div className="p-4 md:p-8 max-w-xl">
        {caixa === undefined ? (
          <CarregandoSecao />
        ) : fechadoComSucesso ? (
          <div className={`${CARTAO} relative`}>
            <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
            <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
              <span className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center shadow-lg shadow-primary/40 ring-1 ring-white/30">
                <CheckCircle2 className="w-8 h-8" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-lg font-semibold text-foreground">Caixa fechado com sucesso!</p>
                <p className="text-sm text-muted mt-1 max-w-sm">
                  Já pode encerrar o expediente. Para abrir um novo caixa, vá até a tela de Venda.
                </p>
              </div>
            </div>
          </div>
        ) : caixa === null ? (
          <div className={CARTAO}>
            <EstadoVazio
              icone={<Vault className="w-7 h-7" strokeWidth={1.6} />}
              mensagem="Nenhum caixa aberto no momento."
            />
          </div>
        ) : (
          <div className={`${CARTAO} relative`}>
            <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
            <div className="flex items-center gap-3.5 bg-primary-soft px-5 pt-6 pb-4 border-b border-border/60">
              <span className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center shrink-0 shadow-lg shadow-primary/40 ring-1 ring-white/30">
                <Unlock className="w-5 h-5" strokeWidth={1.75} />
                <span aria-hidden className="absolute -right-1 -top-1 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-surface" />
                </span>
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary-dark/70 font-semibold">
                  Caixa aberto
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-primary-dark/80 mt-1">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Aberto por {caixa.usuarioAberturaNome}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatarDataHora(caixa.dataAbertura)}
                  </span>
                  <span className="flex items-center gap-1">
                    Valor inicial: {formatarMoeda(caixa.valorInicial)}
                    {caixa.valorInicialOriginal !== null && " (corrigido)"}
                    <EditarAberturaCaixa
                      caixa={caixa}
                      onAtualizado={setCaixa}
                      rotulo="Corrigir"
                      className="text-primary-dark hover:bg-primary/10"
                    />
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              <div className="flex gap-2.5 rounded-xl border border-danger/25 bg-danger-light text-danger text-xs font-medium px-3.5 py-3">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  Conte <strong>apenas o dinheiro em espécie</strong> (cédulas e moedas) que está na
                  gaveta agora. Não é o faturamento do dia — vendas em PIX, cartão de crédito e cartão
                  de débito não entram aqui.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
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
                  className="input w-full text-2xl! font-mono font-semibold tabular-nums py-3.5!"
                  autoFocus
                />
              </div>

              {erro && <Aviso tipo="erro">{erro}</Aviso>}

              <button
                onClick={() => setConfirmando(true)}
                disabled={fechando || valorFinal === ""}
                className={`${BOTAO_PRIMARIO} w-full py-3!`}
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
