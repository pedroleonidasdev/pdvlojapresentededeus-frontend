"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Caixa } from "@/lib/types";
import { formatarDataHora, formatarDataHoraCurta, formatarMoeda, horasDesde } from "@/lib/format";
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

  // a pessoa logada agora não é quem abriu o caixa (ex.: troca de turno).
  // Compara pelo login (único); se o backend não enviar, cai para o nome.
  const normalizar = (n: string) => n.trim().toLowerCase();
  const mesmaPessoa =
    !!caixa && !!usuario && (caixa.usuarioAberturaLogin
      ? normalizar(usuario.login) === normalizar(caixa.usuarioAberturaLogin)
      : normalizar(usuario.nome) === normalizar(caixa.usuarioAberturaNome));
  const operandoOutraPessoa = aberto && !!caixa && !!usuario && !mesmaPessoa;

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
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
            aberto ? "text-success-light" : "text-red-200"
          }`}
          title={aberto ? "Caixa aberto" : "Caixa fechado"}
        >
          {dot}
          {aberto ? "Caixa aberto" : "Caixa fechado"}
        </div>
        {aberto && caixa && (
          <div className="mt-1.5 space-y-1 pl-4 text-[10px] leading-tight text-white/60">
            {/* quem abriu e quando */}
            <p
              title={`Aberto por ${caixa.usuarioAberturaNome} em ${formatarDataHora(caixa.dataAbertura)}`}
            >
              Aberto por{" "}
              <span className="font-semibold text-white/85">{caixa.usuarioAberturaNome}</span>
              <span className="block">{formatarDataHoraCurta(caixa.dataAbertura)}</span>
            </p>

            {/* quem reabriu (só aparece se o caixa foi reaberto) */}
            {caixa.usuarioReaberturaNome && caixa.dataReabertura && (
              <p title={`Reaberto por ${caixa.usuarioReaberturaNome} em ${formatarDataHora(caixa.dataReabertura)}`}>
                Reaberto por{" "}
                <span className="font-semibold text-white/85">{caixa.usuarioReaberturaNome}</span>
                <span className="block">{formatarDataHoraCurta(caixa.dataReabertura)}</span>
              </p>
            )}

            {/* quem está operando agora, quando é outra pessoa (troca de turno) */}
            {operandoOutraPessoa && usuario && (
              <p
                className="flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 ring-1 ring-white/10"
                title={`${usuario.nome} está logado(a) neste caixa, aberto por ${caixa.usuarioAberturaNome}`}
              >
                <UserRound className="h-3 w-3 shrink-0 text-accent-light" />
                <span className="min-w-0">
                  <span className="block text-[9px] uppercase tracking-wider text-white/50">Operando agora</span>
                  <span className="block truncate font-semibold text-white">{usuario.nome}</span>
                </span>
              </p>
            )}

            {/* valor de abertura (editável) */}
            <p
              className="flex items-center gap-0.5"
              title={
                caixa.valorInicialOriginal !== null
                  ? `Valor corrigido por ${caixa.usuarioEdicaoAberturaNome ?? "—"} (era ${formatarMoeda(caixa.valorInicialOriginal)})`
                  : "Valor de abertura do caixa"
              }
            >
              <span>
                Abertura: {formatarMoeda(caixa.valorInicial)}
                {caixa.valorInicialOriginal !== null && " (corrigido)"}
              </span>
              <EditarAberturaCaixa caixa={caixa} onAtualizado={setCaixa} className="text-white/70 hover:bg-white/10" />
            </p>
          </div>
        )}
        {caixaEsquecido && (
          <p
            className="mt-1 pl-4 text-[10px] leading-tight font-medium text-amber-300"
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
