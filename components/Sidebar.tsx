"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LayoutGrid, Package, Tag, BarChart3, Users, LogOut, ShoppingCart } from "lucide-react";

const NAV_ITEMS = [
  { href: "/pdv", label: "Venda", icon: ShoppingCart, perfis: ["ADMIN", "CAIXA"] },
  { href: "/estoque", label: "Estoque", icon: Package, perfis: ["ADMIN", "CAIXA"] },
  { href: "/categorias", label: "Categorias", icon: Tag, perfis: ["ADMIN"] },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, perfis: ["ADMIN"] },
  { href: "/usuarios", label: "Usuários", icon: Users, perfis: ["ADMIN"] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { usuario, logout } = useAuth();

  if (!usuario) return null;

  const itens = NAV_ITEMS.filter((item) => item.perfis.includes(usuario.perfil));

  return (
    <aside className="w-60 shrink-0 bg-primary text-white flex flex-col h-screen sticky top-0">
      <div className="p-5 flex items-center gap-2 border-b border-white/10">
        <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center font-mono font-bold text-primary-dark text-sm">
          $
        </div>
        <div>
          <p className="font-semibold leading-none text-sm">Sistema PDV</p>
          <p className="text-[11px] text-white/50 mt-0.5 flex items-center gap-1">
            <LayoutGrid className="w-3 h-3" /> Painel de controle
          </p>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {itens.map((item) => {
          const ativo = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                ativo
                  ? "bg-white/15 text-white font-medium"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <div className="px-3 py-2 mb-1">
          <p className="text-sm font-medium leading-none">{usuario.nome}</p>
          <p className="text-[11px] text-white/50 mt-1 font-mono uppercase tracking-wide">
            {usuario.perfil === "ADMIN" ? "Administrador" : "Operador de caixa"}
          </p>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
