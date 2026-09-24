"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Caixa } from "@/lib/types";

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
      <div
        className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
          aberto ? "text-success-light" : "text-red-200"
        } ${className}`}
        title={aberto ? "Caixa aberto" : "Caixa fechado"}
      >
        {dot}
        {aberto ? "Caixa aberto" : "Caixa fechado"}
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
