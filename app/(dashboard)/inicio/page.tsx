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
    <div className="min-h-full">
      {/* Faixa de boas-vindas, no mesmo espírito visual do painel de login */}
      <div className="relative overflow-hidden bg-primary text-white px-4 py-10 sm:px-8 sm:py-14">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary-dark" />
        <div className="absolute -right-14 -top-14 w-56 h-56 rounded-full bg-white/5" />
        <div className="absolute -right-6 bottom-0 w-40 h-40 rounded-full bg-accent/10" />
        <div className="relative">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/60">
            {saudacao()}, {primeiroNome}
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">
            O que você precisa fazer agora?
          </h1>
          <p className="mt-2 text-sm text-white/70">Escolha uma área para começar.</p>
        </div>
      </div>

      <div className="px-4 py-6 sm:px-8 sm:py-8 space-y-5 max-w-5xl">
        {destaque && (
          <Link
            href={destaque.href}
            className="group flex items-center justify-between gap-4 rounded-2xl bg-primary text-white p-5 sm:p-6 shadow-sm hover:bg-primary-dark hover:shadow-md transition"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <destaque.icon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-lg">{destaque.label}</p>
                <p className="text-sm text-white/70 truncate">{destaque.descricao}</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 shrink-0 opacity-70 group-hover:translate-x-1 transition" />
          </Link>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {outros.map((item) => {
            const cor = CORES[item.href] ?? { bg: "bg-primary", ring: "hover:ring-primary/30" };
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex flex-col gap-3 rounded-2xl bg-surface border border-border p-4 sm:p-5 hover:-translate-y-0.5 hover:ring-2 hover:shadow-sm transition ${cor.ring}`}
              >
                <div className={`w-10 h-10 rounded-lg ${cor.bg} flex items-center justify-center text-white shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{item.label}</p>
                  {item.descricao && (
                    <p className="text-xs text-muted mt-0.5 line-clamp-2">{item.descricao}</p>
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
