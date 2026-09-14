"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Caixa } from "@/lib/types";
import { formatarMoeda, formatarDataHora } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import { Loader2, RotateCcw, User, Clock, CheckCircle2, AlertTriangle, Lock } from "lucide-react";

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

      <div className="p-4 md:p-8 max-w-2xl">
        {carregando ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : caixaAberto ? (
          <div className="bg-surface border border-border rounded-xl p-6 text-center space-y-2">
            <Lock className="w-8 h-8 mx-auto text-muted opacity-50" />
            <p className="text-sm text-foreground font-medium">Já existe um caixa aberto no momento</p>
            <p className="text-xs text-muted">
              Aberto por {caixaAberto.usuarioAberturaNome}, {formatarDataHora(caixaAberto.dataAbertura)}.
              Feche o caixa atual antes de reabrir outro.
            </p>
          </div>
        ) : candidatos.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-6 text-center">
            <RotateCcw className="w-8 h-8 mx-auto mb-2 text-muted opacity-50" />
            <p className="text-sm text-muted">Nenhum caixa fechado hoje ou ontem para reabrir.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {erro && <div className="rounded-lg bg-danger-light text-danger text-sm px-3 py-2">{erro}</div>}

            {candidatos.map((caixa) => (
              <div key={caixa.id} className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="text-xs text-muted space-y-1">
                    <p className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      Aberto por {caixa.usuarioAberturaNome}, {formatarDataHora(caixa.dataAbertura)}
                    </p>
                    <p className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Fechado por {caixa.usuarioFechamentoNome},{" "}
                      {caixa.dataFechamento && formatarDataHora(caixa.dataFechamento)}
                    </p>
                    <p className="font-mono text-foreground">
                      Valor inicial: {formatarMoeda(caixa.valorInicial)} · Contado no fechamento:{" "}
                      {formatarMoeda(caixa.valorFinal ?? 0)}
                    </p>
                  </div>

                  {idReabertoComSucesso === caixa.id ? (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-primary-dark bg-primary-light px-3 py-1.5 rounded-lg">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Reaberto
                    </span>
                  ) : idEmConfirmacao === caixa.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIdEmConfirmacao(null)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-background transition"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => reabrir(caixa.id)}
                        disabled={reabrindo}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary hover:bg-primary-dark text-white transition disabled:opacity-50"
                      >
                        {reabrindo && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Confirmar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIdEmConfirmacao(caixa.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-background transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reabrir
                    </button>
                  )}
                </div>

                {idEmConfirmacao === caixa.id && (
                  <div className="flex gap-2 bg-danger-light text-danger text-xs px-5 py-2.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <p>
                      Isso reabre esse caixa com o valor inicial original ({formatarMoeda(caixa.valorInicial)}),
                      apagando o fechamento atual. Confirma?
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
