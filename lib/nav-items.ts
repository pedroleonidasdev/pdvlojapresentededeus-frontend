import { LayoutGrid, Package, Tag, BarChart3, Users, ShoppingCart, type LucideIcon } from "lucide-react";
import { Perfil } from "./types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  perfis: Perfil[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/pdv", label: "Venda", icon: ShoppingCart, perfis: ["ADMIN", "CAIXA"] },
  { href: "/estoque", label: "Estoque", icon: Package, perfis: ["ADMIN", "CAIXA"] },
  { href: "/categorias", label: "Categorias", icon: Tag, perfis: ["ADMIN"] },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, perfis: ["ADMIN"] },
  { href: "/usuarios", label: "Usuários", icon: Users, perfis: ["ADMIN"] },
];

/**
 * Retorna o NavItem correspondente à rota atual (o primeiro cujo `href` é prefixo
 * do pathname), ou undefined se a rota não estiver no menu (ex: raiz do dashboard).
 */
export function encontrarNavItemPorPath(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => pathname.startsWith(item.href));
}

// Reexportado só por conveniência, caso algum componente queira o ícone do painel.
export { LayoutGrid };
