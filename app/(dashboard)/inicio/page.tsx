"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { NAV_ITEMS } from "@/lib/nav-items";

// Cor de destaque de cada atalho — usa os mesmos tokens de cor do resto do
// sistema (ver app/globals.css), só escolhendo qual delas cada área usa.
const CORES: Record<string, { bg: string; ring: string }> = {
  "/trocas": { bg: "bg-info", ring: "hover:ring-info/30" },
  "/vendas": { bg: "bg-secondary", ring: "hover:ring-secondary/30" },
  "/fechar-caixa": { bg: "bg-accent", ring: "hover:ring-accent/30" },
  "/reabrir-caixa": { bg: "bg-danger", ring: "hover:ring-danger/30" },
  "/estoque": { bg: "bg-success", ring: "hover:ring-success/30" },
  "/categorias": { bg: "bg-secondary", ring: "hover:ring-secondary/30" },
  "/relatorios": { bg: "bg-info", ring: "hover:ring-info/30" },
  "/financas": { bg: "bg-accent", ring: "hover:ring-accent/30" },
  "/usuarios": { bg: "bg-primary-dark", ring: "hover:ring-primary/30" },
};

function saudacao(): string {
  const hora = new Date().getHours();
  if (hora < 5) return "Boa madrugada";
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

export default function InicioPage() {
  const { usuario } = useAuth();

  // a DashboardLayout só renderiza esta página depois de confirmar que existe
  // um usuário logado, mas mantemos essa guarda por segurança/tipagem.
  if (!usuario) return null;

  const itens = NAV_ITEMS.filter((item) => item.href !== "/inicio" && item.perfis.includes(usuario.perfil));
  const destaque = itens.find((item) => item.href === "/pdv");
  const outros = itens.filter((item) => item.href !== "/pdv");
  const primeiroNome = usuario.nome.split(" ")[0];

  return (
    // h-full: ocupa exatamente a altura disponível (definida pelo <main> do layout),
    // nem mais nem menos — é isso que permite o grid esticar pra preencher sem sobrar
    // espaço em branco e sem precisar de scroll.
    <div className="h-full flex flex-col">
      {/* Faixa de boas-vindas, no mesmo espírito visual do painel de login */}
      <div className="shrink-0 relative overflow-hidden bg-primary text-white px-4 py-5 sm:px-8 sm:py-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary-dark" />
        <div className="absolute -right-14 -top-14 w-56 h-56 rounded-full bg-white/5" />
        <div className="relative">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/60">
            {saudacao()}, {primeiroNome}
          </p>
          <h1 className="mt-0.5 text-xl sm:text-2xl font-semibold tracking-tight">
            O que você precisa fazer agora?
          </h1>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-3 px-4 py-4 sm:px-8 sm:py-5 max-w-5xl w-full mx-auto">
        {destaque && (
          <Link
            href={destaque.href}
            className="shrink-0 group flex items-center justify-between gap-4 rounded-xl bg-primary text-white p-4 sm:p-5 shadow-sm hover:bg-primary-dark hover:shadow-md transition"
          >
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <destaque.icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-base sm:text-lg">{destaque.label}</p>
                <p className="text-xs sm:text-sm text-white/70 truncate">{destaque.descricao}</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 shrink-0 opacity-70 group-hover:translate-x-1 transition" />
          </Link>
        )}

        {/* auto-rows-fr: cada linha do grid divide igualmente o espaço restante,
            então os cards crescem (ou encolhem) pra preencher a área toda. */}
        <div className="flex-1 min-h-0 grid grid-cols-2 sm:grid-cols-3 auto-rows-fr gap-2.5 sm:gap-3">
          {outros.map((item) => {
            const cor = CORES[item.href] ?? { bg: "bg-primary", ring: "hover:ring-primary/30" };
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 sm:gap-4 rounded-xl bg-surface border border-border p-3 sm:p-5 hover:-translate-y-0.5 hover:ring-2 hover:shadow-sm transition ${cor.ring}`}
              >
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg ${cor.bg} flex items-center justify-center text-white shrink-0`}>
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm sm:text-lg text-foreground truncate">{item.label}</p>
                  {item.descricao && (
                    <p className="text-xs sm:text-sm text-muted truncate">{item.descricao}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
