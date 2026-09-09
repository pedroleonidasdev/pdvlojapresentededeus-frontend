"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Caixa } from "@/lib/types";
import { formatarMoeda, formatarDataHora } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import { Loader2, Unlock, User, Clock, CheckCircle2, Vault } from "lucide-react";

/**
 * Tela simples de fechamento de caixa para o operador: ele informa quanto tem
 * fisicamente em caixa e confirma. De propósito, essa tela NÃO mostra o
 * faturamento do dia nem qualquer comparativo — só o ADMIN vê isso, em
 * Relatórios. O operador fecha o caixa "às cegas", sem precisar saber quanto
 * deveria ter.
 */
export default function FecharCaixaPage() {
  const [caixa, setCaixa] = useState<Caixa | null | undefined>(undefined);
  const [valorFinal, setValorFinal] = useState("");
  const [fechando, setFechando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [fechadoComSucesso, setFechadoComSucesso] = useState(false);

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
    if (valorFinal === "") return;
    setFechando(true);
    setErro(null);
    try {
      await api.post("/caixa/fechar", {
        valorFinal: Number(valorFinal.replace(",", ".")) || 0,
      });
      setFechadoComSucesso(true);
      setCaixa(null);
      setValorFinal("");
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

      <div className="p-4 md:p-8 max-w-lg">
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
          <div className="bg-surface border border-border rounded-xl p-6 text-center">
            <Vault className="w-8 h-8 mx-auto mb-2 text-muted opacity-50" />
            <p className="text-sm text-muted">Nenhum caixa aberto no momento.</p>
          </div>
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
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">
                  Quanto tem fisicamente em caixa agora?
                </label>
                <input
                  inputMode="decimal"
                  value={valorFinal}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^[0-9]*[.,]?[0-9]*$/.test(v)) setValorFinal(v);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && fecharCaixa()}
                  placeholder="R$ 0,00"
                  className="input w-full text-lg font-mono"
                  autoFocus
                />
              </div>

              {erro && <div className="rounded-lg bg-danger-light text-danger text-sm px-3 py-2">{erro}</div>}

              <button
                onClick={fecharCaixa}
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
    </div>
  );
}
