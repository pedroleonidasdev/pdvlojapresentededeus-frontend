import { LayoutGrid, Home, Package, Tag, BarChart3, Users, ShoppingCart, Repeat, Receipt, Vault, Wallet, RotateCcw, type LucideIcon } from "lucide-react";
import { Perfil } from "./types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  perfis: Perfil[];
  /** Frase curta usada nos cards da tela inicial (/inicio). Opcional porque a Sidebar não usa. */
  descricao?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/inicio", label: "Início", icon: Home, perfis: ["ADMIN", "CAIXA"] },
  { href: "/pdv", label: "Venda", icon: ShoppingCart, perfis: ["ADMIN", "CAIXA"], descricao: "Registrar uma nova venda" },
  { href: "/trocas", label: "Trocas", icon: Repeat, perfis: ["ADMIN", "CAIXA"], descricao: "Trocar ou devolver produtos" },
  { href: "/vendas", label: "Vendas", icon: Receipt, perfis: ["ADMIN", "CAIXA"], descricao: "Consultar vendas registradas" },
  { href: "/fechar-caixa", label: "Fechar Caixa", icon: Vault, perfis: ["ADMIN", "CAIXA"], descricao: "Conferir e fechar o caixa do dia" },
  { href: "/reabrir-caixa", label: "Reabrir Caixa", icon: RotateCcw, perfis: ["ADMIN"], descricao: "Reabrir um caixa já fechado" },
  { href: "/estoque", label: "Estoque", icon: Package, perfis: ["ADMIN", "CAIXA"], descricao: "Produtos, preços e estoque" },
  { href: "/categorias", label: "Categorias", icon: Tag, perfis: ["ADMIN"], descricao: "Organizar os produtos por categoria" },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, perfis: ["ADMIN"], descricao: "Faturamento e desempenho de vendas" },
  { href: "/financas", label: "Controle Finanças", icon: Wallet, perfis: ["ADMIN"], descricao: "Despesas e fluxo financeiro" },
  { href: "/usuarios", label: "Usuários", icon: Users, perfis: ["ADMIN"], descricao: "Gerenciar contas de acesso" },
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
