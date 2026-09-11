"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { encontrarNavItemPorPath } from "@/lib/nav-items";
import Sidebar from "@/components/Sidebar";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { usuario, carregando } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // rota atual não permitida para o perfil do usuário logado (ex: CAIXA acessando /usuarios)
  const item = pathname ? encontrarNavItemPorPath(pathname) : undefined;
  const acessoNegado = !!usuario && !!item && !item.perfis.includes(usuario.perfil);

  useEffect(() => {
    if (!carregando && !usuario) {
      router.replace("/login");
    } else if (!carregando && acessoNegado) {
      router.replace("/pdv");
    }
  }, [carregando, usuario, acessoNegado, router]);

  if (carregando || !usuario || acessoNegado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
