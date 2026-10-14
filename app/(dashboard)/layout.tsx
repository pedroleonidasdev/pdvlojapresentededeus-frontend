"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { encontrarNavItemPorPath } from "@/lib/nav-items";
import Sidebar from "@/components/Sidebar";
import AtualizacaoSistema from "@/components/AtualizacaoSistema";
import MonitorCaixa from "@/components/MonitorCaixa";
import api from "@/lib/api";
import { Menu } from "lucide-react";
import { TelaCarregamento } from "@/components/CarregamentoCatolico";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { usuario, carregando } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);

  // rota atual não permitida para o perfil do usuário logado (ex: CAIXA acessando /usuarios)
  const item = pathname ? encontrarNavItemPorPath(pathname) : undefined;
  const acessoNegado = !!usuario && !!item && !item.perfis.includes(usuario.perfil);

  useEffect(() => {
    if (!carregando && !usuario) {
      router.replace("/login");
    } else if (!carregando && acessoNegado) {
      router.replace("/inicio");
    }
  }, [carregando, usuario, acessoNegado, router]);

  // batimento: mantém o usuário "online" mesmo parado numa tela sem requisições
  const logado = !!usuario;
  useEffect(() => {
    if (!logado) return;
    const ping = () => api.post("/presenca/ping").catch(() => {});
    ping();
    const intervalo = setInterval(ping, 60_000);
    return () => clearInterval(intervalo);
  }, [logado]);

  if (carregando || !usuario || acessoNegado) {
    return <TelaCarregamento mensagem={carregando ? "Abrindo o sistema…" : "Verificando acesso…"} />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AtualizacaoSistema />
      {/* aviso de caixa aberto/fechado: só para quem tem perfil ADMIN */}
      {usuario.perfil === "ADMIN" && <MonitorCaixa />}
      <Sidebar aberta={menuAberto} onFechar={() => setMenuAberto(false)} />

      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        {/* Barra superior só aparece no celular/tablet — no desktop o menu lateral fica sempre visível */}
        <div
          className="md:hidden flex items-center gap-3 px-4 py-3 bg-primary text-white shrink-0"
          style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}
        >
          <button
            onClick={() => setMenuAberto(true)}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10 transition"
            aria-label="Abrir menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="w-7 h-7 rounded-md overflow-hidden ring-1 ring-white/20 shrink-0">
            <img src="/icon-192.png" alt="" className="w-full h-full object-cover" />
          </div>
          <p className="font-semibold text-sm truncate">Sistema de Gestão</p>
        </div>

        <main
          className="flex-1 min-h-0 min-w-0 overflow-y-auto"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
