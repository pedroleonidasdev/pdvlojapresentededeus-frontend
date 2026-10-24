"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { avisarCaixaMudou } from "@/lib/caixa-eventos";
import { Caixa } from "@/lib/types";
import { formatarMoeda, formatarDataHora } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import { Loader2, RotateCcw, User, Clock, CheckCircle2, AlertTriangle, Lock } from "lucide-react";
import { CarregandoSecao } from "@/components/CarregamentoCatolico";
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CARTAO, Aviso, EstadoVazio, Selo } from "@/components/ui";

/**
 * Tela exclusiva de ADMIN para reabrir um caixa fechado por engano.
 * Só lista (e só permite reabrir) caixas fechados hoje ou ontem — ver a mesma
 * regra no backend, CaixaService.reabrir. Não é possível reabrir se houver
 * outro caixa aberto no momento (regra de "só um caixa aberto por vez").
 */
export default function ReabrirCaixaPage() {
  const [caixaAberto, setCaixaAberto] = useState<Caixa | null | undefined>(undefined);
  const [candidatos, setCandidatos] = useState<Caixa[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [idEmConfirmacao, setIdEmConfirmacao] = useState<number | null>(null);
  const [reabrindo, setReabrindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [idReabertoComSucesso, setIdReabertoComSucesso] = useState<number | null>(null);

  async function carregar() {
    setCarregando(true);
    try {
      const [resAtual, resFechados] = await Promise.all([
        api.get<Caixa>("/caixa/atual"),
        api.get<Caixa[]>("/caixa/fechados-recentes"),
      ]);
      const aberto =
        resAtual.status === 204 || !resAtual.data || !("id" in resAtual.data) ? null : resAtual.data;
      setCaixaAberto(aberto);
      setCandidatos(resFechados.data);
    } catch {
      setCaixaAberto(null);
      setCandidatos([]);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function reabrir(id: number) {
    setReabrindo(true);
    setErro(null);
    try {
      await api.post(`/caixa/${id}/reabrir`);
      avisarCaixaMudou();
      setIdEmConfirmacao(null);
      setIdReabertoComSucesso(id);
      await carregar();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Não foi possível reabrir este caixa.";
      setErro(msg);
    } finally {
      setReabrindo(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Reabrir Caixa"
        subtitle="Corrige um fechamento feito por engano — só caixas fechados hoje ou ontem"
      />

      <div className="p-4 md:p-8 max-w-3xl">
        {carregando ? (
          <CarregandoSecao />
        ) : caixaAberto ? (
          <div className={CARTAO}>
            <EstadoVazio
              icone={<Lock className="w-7 h-7" strokeWidth={1.6} />}
              mensagem="Já existe um caixa aberto no momento"
              acao={
                <p className="text-xs text-muted max-w-sm">
                  Aberto por {caixaAberto.usuarioAberturaNome}, {formatarDataHora(caixaAberto.dataAbertura)}. Feche o caixa
                  atual antes de reabrir outro.
                </p>
              }
            />
          </div>
        ) : candidatos.length === 0 ? (
          <div className={CARTAO}>
            <EstadoVazio
              icone={<RotateCcw className="w-7 h-7" strokeWidth={1.6} />}
              mensagem="Nenhum caixa fechado hoje ou ontem para reabrir."
            />
          </div>
        ) : (
          <div className="space-y-4">
            {erro && <Aviso tipo="erro">{erro}</Aviso>}

            {candidatos.map((caixa) => (
              <div key={caixa.id} className={`${CARTAO} relative`}>
                <div aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-accent via-primary to-primary-dark" />
                <div className="flex flex-wrap items-center justify-between gap-4 pl-6 pr-5 py-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center shrink-0 shadow-lg shadow-primary/30 ring-1 ring-white/30">
                      <Lock className="w-5 h-5" strokeWidth={1.75} />
                    </span>
                    <div className="space-y-1.5 min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        Caixa #{caixa.id}
                        <Selo>Fechado</Selo>
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-muted">
                        <User className="w-3 h-3 shrink-0" />
                        Aberto por {caixa.usuarioAberturaNome}, {formatarDataHora(caixa.dataAbertura)}
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-muted">
                        <Clock className="w-3 h-3 shrink-0" />
                        Fechado por {caixa.usuarioFechamentoNome},{" "}
                        {caixa.dataFechamento && formatarDataHora(caixa.dataFechamento)}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <span className="rounded-lg bg-primary-soft px-2.5 py-1 font-mono text-xs text-foreground">
                          Inicial <b className="tabular-nums">{formatarMoeda(caixa.valorInicial)}</b>
                        </span>
                        <span className="rounded-lg bg-accent-light/70 px-2.5 py-1 font-mono text-xs text-foreground">
                          Contado <b className="tabular-nums">{formatarMoeda(caixa.valorFinal ?? 0)}</b>
                        </span>
                      </div>
                    </div>
                  </div>

                  {idReabertoComSucesso === caixa.id ? (
                    <Selo tom="sucesso">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Reaberto
                    </Selo>
                  ) : idEmConfirmacao === caixa.id ? (
                    <div className="flex gap-2">
                      <button onClick={() => setIdEmConfirmacao(null)} className={BOTAO_SECUNDARIO}>
                        Cancelar
                      </button>
                      <button onClick={() => reabrir(caixa.id)} disabled={reabrindo} className={BOTAO_PRIMARIO}>
                        {reabrindo && <Loader2 className="w-4 h-4 animate-spin" />}
                        Confirmar
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setIdEmConfirmacao(caixa.id)} className={BOTAO_SECUNDARIO}>
                      <RotateCcw className="w-4 h-4" />
                      Reabrir
                    </button>
                  )}
                </div>

                {idEmConfirmacao === caixa.id && (
                  <div className="flex gap-2 bg-danger-light text-danger text-xs font-medium pl-6 pr-5 py-3 border-t border-danger/20">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <p>
                      Isso reabre esse caixa com o valor inicial original ({formatarMoeda(caixa.valorInicial)}), apagando o
                      fechamento atual. Confirma?
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
