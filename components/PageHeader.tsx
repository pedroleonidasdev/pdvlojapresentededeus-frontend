"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // "/inicio" é a tela inicial do sistema (pra onde o login sempre leva),
  // então não faz sentido ter botão de voltar nela — nas demais, volta pra lá.
  const mostrarVoltar = pathname !== "/inicio";

  return (
    <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-3 px-4 py-4 sm:px-8 sm:py-6 border-b border-border bg-surface overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-secondary" />
      <div className="min-w-0 flex items-start gap-2.5">
        {mostrarVoltar && (
          <button
            type="button"
            onClick={() => {
              // se o usuário chegou aqui navegando dentro do próprio app, volta um
              // passo no histórico; senão (ex: link direto/recarregou a página),
              // cai na tela inicial em vez de sair do sistema.
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push("/inicio");
              }
            }}
            aria-label="Voltar"
            title="Voltar"
            className="mt-0.5 shrink-0 p-2 -ml-2 rounded-lg text-muted hover:text-foreground hover:bg-background active:bg-border transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground truncate">{title}</h1>
          {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
