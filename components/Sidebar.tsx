"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LogOut } from "lucide-react";
import { NAV_ITEMS, LayoutGrid } from "@/lib/nav-items";

export default function Sidebar() {
  const pathname = usePathname();
  const { usuario, logout } = useAuth();

  if (!usuario) return null;

  const itens = NAV_ITEMS.filter((item) => item.perfis.includes(usuario.perfil));

  return (
    <aside className="w-60 shrink-0 bg-primary text-white flex flex-col h-screen sticky top-0">
      <div className="p-5 flex items-center gap-3 border-b border-white/10">
        <div className="w-9 h-9 rounded-full overflow-hidden ring-1 ring-accent/60 shrink-0">
          <img src="/images/sao-miguel-arcanjo-icone.jpg" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0">
          <p className="font-serif leading-none text-[15px] truncate">Presente de Deus</p>
          <p className="text-[11px] text-white/50 mt-1 flex items-center gap-1">
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
              className={`relative flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-lg text-sm transition ${
                ativo
                  ? "bg-white/10 text-white font-medium"
                  : "text-white/65 hover:bg-white/5 hover:text-white"
              }`}
            >
              {ativo && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full bg-accent" />
              )}
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
