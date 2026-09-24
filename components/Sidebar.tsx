"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LogOut, UserCog, X } from "lucide-react";
import { NAV_ITEMS, LayoutGrid } from "@/lib/nav-items";
import TrocarUsuarioModal from "./TrocarUsuarioModal";
import CaixaStatusBadge from "./CaixaStatusBadge";

export default function Sidebar({ aberta, onFechar }: { aberta: boolean; onFechar: () => void }) {
  const pathname = usePathname();
  const { usuario, logout } = useAuth();
  const [trocandoUsuario, setTrocandoUsuario] = useState(false);

  if (!usuario) return null;

  const itens = NAV_ITEMS.filter((item) => item.perfis.includes(usuario.perfil));

  return (
    <>
      {/* fundo escurecido atrás do menu quando aberto no celular — clicar nele fecha */}
      {aberta && (
        <div
          onClick={onFechar}
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          aria-hidden="true"
        />
      )}

      <aside
        className={`w-64 md:w-60 shrink-0 bg-gradient-to-b from-primary via-primary to-primary-dark text-white flex flex-col h-dvh md:h-screen fixed md:sticky top-0 left-0 z-50 overflow-hidden transition-transform duration-300 ease-out ${
          aberta ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="p-5 flex items-center gap-2 border-b border-white/10 shrink-0">
          <div className="w-9 h-9 rounded-lg overflow-hidden ring-1 ring-white/20 shadow-sm shrink-0">
            <img src="/icon-192.png" alt="" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-none text-sm">Sistema de Gestão</p>
            <p className="text-[11px] text-accent-light/80 mt-0.5 flex items-center gap-1">
              <LayoutGrid className="w-3 h-3" /> Painel de controle
            </p>
            <CaixaStatusBadge variant="dark" className="mt-1.5" />
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar menu"
            className="md:hidden p-1.5 rounded-lg hover:bg-white/10 active:bg-white/20 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5">
          {itens.map((item) => {
            const ativo = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onFechar}
                className={`group flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm transition-all duration-200 border-l-2 ${
                  ativo
                    ? "bg-white/15 text-white font-medium border-accent"
                    : "text-white/70 border-transparent hover:bg-white/10 hover:text-white hover:border-white/30"
                }`}
              >
                <span
                  className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-all duration-300 ease-out ${
                    ativo
                      ? "bg-accent/20 text-accent animate-icon-glow"
                      : "text-white/70 group-hover:bg-white/10 group-hover:text-white group-hover:scale-110 group-hover:-rotate-3"
                  }`}
                >
                  <Icon className="w-[20px] h-[20px] transition-transform duration-300" strokeWidth={ativo ? 2.3 : 2} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div
          className="p-3 border-t border-white/10 shrink-0 space-y-1.5"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-medium leading-none">{usuario.nome}</p>
            <p className="text-[11px] text-white/50 mt-1 font-mono uppercase tracking-wide">
              {usuario.perfil === "ADMIN" ? "Administrador" : "Operador de caixa"}
            </p>
          </div>
          <button
            onClick={() => setTrocandoUsuario(true)}
            className="group w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm transition-all duration-200 border-l-2 border-transparent text-white/70 hover:bg-white/10 hover:text-white hover:border-white/30"
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 text-white/70 transition-all duration-300 ease-out group-hover:bg-white/10 group-hover:text-white group-hover:scale-110 group-hover:-rotate-3">
              <UserCog className="w-[19px] h-[19px]" />
            </span>
            Trocar usuário
          </button>
          <button
            onClick={logout}
            className="group w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm transition-all duration-200 border-l-2 border-transparent text-white/70 hover:bg-white/10 hover:text-white hover:border-white/30"
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 text-white/70 transition-all duration-300 ease-out group-hover:bg-white/10 group-hover:text-white group-hover:scale-110 group-hover:-rotate-3">
              <LogOut className="w-[19px] h-[19px]" />
            </span>
            Sair
          </button>
        </div>

        {trocandoUsuario && <TrocarUsuarioModal onFechar={() => setTrocandoUsuario(false)} />}
      </aside>
    </>
  );
}
