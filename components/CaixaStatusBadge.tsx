"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Caixa } from "@/lib/types";
import { formatarDataHora, formatarMoeda, horasDesde } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { UserRound } from "lucide-react";
import EditarAberturaCaixa from "./EditarAberturaCaixa";

/**
 * Bolinha de status do caixa: verde = aberto, vermelha = fechado.
 * Busca sozinho em GET /caixa/atual (mesmo endpoint já usado em
 * Relatórios, Fechar Caixa, Reabrir Caixa e na tela de Venda), então
 * basta colocar <CaixaStatusBadge /> em qualquer lugar do layout.
 */
export default function CaixaStatusBadge({
  className = "",
  variant = "pill",
}: {
  className?: string;
  /** "pill": fundo colorido (light/danger-light) — usar em fundo claro.
   *  "dark": sem fundo, texto claro — usar sobre a sidebar (fundo verde escuro). */
  variant?: "pill" | "dark";
}) {
  const { usuario } = useAuth();
  // undefined = ainda carregando (não mostra nada, evita "piscar" errado)
  const [caixa, setCaixa] = useState<Caixa | null | undefined>(undefined);

  useEffect(() => {
    let ativo = true;

    async function buscar() {
      try {
        const { data, status } = await api.get<Caixa>("/caixa/atual");
        if (!ativo) return;
        setCaixa(status === 204 || !data || !("id" in data) ? null : data);
      } catch {
        if (ativo) setCaixa(null);
      }
    }

    buscar();
    // reconsulta a cada 30s pra refletir se alguém abriu/fechou o caixa em outra aba/dispositivo
    const intervalo = setInterval(buscar, 30_000);
    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, []);

  if (caixa === undefined) return null;

  const aberto = caixa !== null;

  // caixa aberto há muitas horas costuma ser esquecimento (virou o dia sem fechar)
  const LIMITE_HORAS_ESQUECIDO = 12;
  const horasAberto = aberto && caixa ? Math.floor(horasDesde(caixa.dataAbertura)) : 0;
  const caixaEsquecido = horasAberto >= LIMITE_HORAS_ESQUECIDO;

  // Quem está operando agora = quem está online (vem do backend, então aparece para
  // qualquer pessoa que olhe a sidebar). O usuário técnico "admin" nunca entra na lista.
  // O usuário logado neste aparelho é somado, para não depender do próximo ciclo de presença.
  const normalizar = (n: string) => n.trim().toLowerCase();
  const operadores: { nome: string; login: string }[] = [];
  if (aberto && caixa) {
    for (const o of [...(caixa.operadoresOnline ?? []), ...(usuario ? [usuario] : [])]) {
      if (normalizar(o.login) === "admin") continue;
      if (operadores.some((x) => normalizar(x.login) === normalizar(o.login))) continue;
      operadores.push({ nome: o.nome, login: o.login });
    }
    operadores.sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
  }

  // "14/10/2026 às 08:13" (data completa, sem "hoje", para ficar explícito)
  const dataExplicita = (iso: string) => formatarDataHora(iso).replace(", ", " às ");

  const dot = (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {aberto && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
      )}
      <span
        className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
          aberto ? "bg-success" : variant === "dark" ? "bg-red-400" : "bg-danger"
        }`}
      />
    </span>
  );

  if (variant === "dark") {
    return (
      <div className={className}>
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur shadow-sm ${
            aberto ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100" : "border-red-300/40 bg-red-400/15 text-red-100"
          }`}
          title={aberto ? "Caixa aberto" : "Caixa fechado"}
        >
          {dot}
          {aberto ? "Caixa aberto" : "Caixa fechado"}
        </div>
        {aberto && caixa && (
          <div className="mt-2 space-y-2.5 pl-4 leading-tight">
            {/* quem abriu e quando */}
            <div title={`Aberto por ${caixa.usuarioAberturaNome} em ${formatarDataHora(caixa.dataAbertura)}`}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-white/55">Aberto por</p>
              <p className="truncate text-sm font-semibold text-white">{caixa.usuarioAberturaNome}</p>
              <p className="text-xs text-white/75">em {dataExplicita(caixa.dataAbertura)}</p>
            </div>

            {/* quem reabriu (só aparece se o caixa foi reaberto) */}
            {caixa.usuarioReaberturaNome && caixa.dataReabertura && (
              <div title={`Reaberto por ${caixa.usuarioReaberturaNome} em ${formatarDataHora(caixa.dataReabertura)}`}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-white/55">Reaberto por</p>
                <p className="truncate text-sm font-semibold text-white">{caixa.usuarioReaberturaNome}</p>
                <p className="text-xs text-white/75">em {dataExplicita(caixa.dataReabertura)}</p>
              </div>
            )}

            {/* quem está operando agora (online) */}
            {operadores.length > 0 && (
              <div
                className="flex items-start gap-2 rounded-lg bg-white/10 px-2.5 py-1.5 ring-1 ring-accent/40"
                title={`Online agora: ${operadores.map((o) => o.nome).join(", ")}`}
              >
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-accent-light" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-accent-light">Operando agora</p>
                  {operadores.map((o) => (
                    <p key={o.login} className="truncate text-sm font-bold text-white">
                      {o.nome}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* valor de abertura (editável) */}
            <div
              title={
                caixa.valorInicialOriginal !== null
                  ? `Valor corrigido por ${caixa.usuarioEdicaoAberturaNome ?? "—"} (era ${formatarMoeda(caixa.valorInicialOriginal)})`
                  : "Valor de abertura do caixa"
              }
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-white/55">Valor de abertura</p>
              <p className="flex items-center gap-1 text-sm font-semibold text-white">
                <span>
                  {formatarMoeda(caixa.valorInicial)}
                  {caixa.valorInicialOriginal !== null && (
                    <span className="ml-1 text-xs font-normal text-white/70">(corrigido)</span>
                  )}
                </span>
                <EditarAberturaCaixa caixa={caixa} onAtualizado={setCaixa} className="text-white/70 hover:bg-white/10" />
              </p>
            </div>
          </div>
        )}
        {caixaEsquecido && (
          <p
            className="mt-2 pl-4 text-xs leading-tight font-medium text-amber-300"
            title="Este caixa está aberto há muitas horas. Confira se não ficou aberto por esquecimento."
          >
            Aberto há {horasAberto}h — confira se precisa fechar
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs sm:text-sm font-medium ${
        aberto
          ? "bg-success-light border-success/30 text-success"
          : "bg-danger-light border-danger/30 text-danger"
      } ${className}`}
      title={aberto ? "Caixa aberto" : "Caixa fechado"}
    >
      {dot}
      {aberto ? "Caixa aberto" : "Caixa fechado"}
    </div>
  );
}
