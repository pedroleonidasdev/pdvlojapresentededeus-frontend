"use client";

import { useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { RelatorioVendas, Venda } from "@/lib/types";
import { formatarMoeda, LABEL_FORMA_PAGAMENTO } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import { Loader2, TrendingUp, Receipt, Wallet, Clock, User, Trash2 } from "lucide-react";

function formatarDataHora(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RelatoriosPage() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === "ADMIN";

  const hoje = new Date();
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const [inicio, setInicio] = useState(primeiroDiaMes.toISOString().slice(0, 10));
  const [fim, setFim] = useState(hoje.toISOString().slice(0, 10));
  const [relatorio, setRelatorio] = useState<RelatorioVendas | null>(null);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);
  const [excluindoTodas, setExcluindoTodas] = useState(false);

  async function gerar() {
    setCarregando(true);
    try {
      const params = {
        inicio: `${inicio}T00:00:00`,
        fim: `${fim}T23:59:59`,
      };

      const [resRelatorio, resVendas] = await Promise.all([
        api.get<RelatorioVendas>("/relatorios/vendas", { params }),
        api.get<Venda[]>("/vendas", { params }),
      ]);

      setRelatorio(resRelatorio.data);
      setVendas(resVendas.data);
    } finally {
      setCarregando(false);
    }
  }

  async function excluirVenda(id: number) {
    if (!confirm(`Excluir a venda #${id}? O estoque dos produtos será devolvido.`)) return;
    setExcluindoId(id);
    try {
      await api.delete(`/vendas/${id}`);
      await gerar();
    } finally {
      setExcluindoId(null);
    }
  }

  async function excluirTodasAsVendas() {
    if (
      !confirm(
        "Tem certeza que deseja excluir TODAS as vendas do sistema? Essa ação não pode ser desfeita e o estoque de todos os produtos vendidos será devolvido."
      )
    )
      return;
    setExcluindoTodas(true);
    try {
      await api.delete("/vendas");
      await gerar();
    } finally {
      setExcluindoTodas(false);
    }
  }

  return (
    <div>
      <PageHeader title="Relatórios" subtitle="Faturamento e desempenho de vendas por período" />

      <div className="p-8 space-y-6">
        <div className="flex items-end gap-3 bg-surface border border-border rounded-xl p-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">De</label>
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Até</label>
            <input
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              className="input"
            />
          </div>
          <button
            onClick={gerar}
            disabled={carregando}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-60 h-fit"
          >
            {carregando && <Loader2 className="w-4 h-4 animate-spin" />}
            Gerar relatório
          </button>

          {isAdmin && vendas.length > 0 && (
            <button
              onClick={excluirTodasAsVendas}
              disabled={excluindoTodas}
              className="ml-auto flex items-center gap-2 bg-danger/10 hover:bg-danger/20 text-danger text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-60 h-fit"
            >
              {excluindoTodas ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Excluir todas as vendas
            </button>
          )}
        </div>

        {relatorio && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <CardMetrica
                icon={TrendingUp}
                label="Total faturado"
                valor={formatarMoeda(relatorio.totalFaturado)}
              />
              <CardMetrica
                icon={Receipt}
                label="Vendas realizadas"
                valor={relatorio.quantidadeVendas.toString()}
              />
              <CardMetrica
                icon={Wallet}
                label="Ticket médio"
                valor={formatarMoeda(
                  relatorio.quantidadeVendas > 0
                    ? relatorio.totalFaturado / relatorio.quantidadeVendas
                    : 0
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-4">Por forma de pagamento</h3>
                <ul className="space-y-3">
                  {Object.entries(relatorio.totalPorFormaPagamento).map(([forma, valor]) => (
                    <li key={forma} className="flex items-center justify-between text-sm">
                      <span className="text-muted">{LABEL_FORMA_PAGAMENTO[forma] ?? forma}</span>
                      <span className="font-mono font-medium">{formatarMoeda(valor)}</span>
                    </li>
                  ))}
                  {Object.keys(relatorio.totalPorFormaPagamento).length === 0 && (
                    <p className="text-sm text-muted">Nenhuma venda no período.</p>
                  )}
                </ul>
              </div>

              <div className="bg-surface border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-4">Produtos mais vendidos</h3>
                <ul className="space-y-3">
                  {relatorio.produtosMaisVendidos.map((p, idx) => (
                    <li key={p.nome} className="flex items-center justify-between text-sm gap-2">
                      <span className="text-muted truncate">
                        <span className="font-mono text-xs text-primary mr-2">
                          {(idx + 1).toString().padStart(2, "0")}
                        </span>
                        {p.nome}
                      </span>
                      <span className="font-mono font-medium whitespace-nowrap">
                        {p.quantidadeVendida}x
                      </span>
                    </li>
                  ))}
                  {relatorio.produtosMaisVendidos.length === 0 && (
                    <p className="text-sm text-muted">Nenhuma venda no período.</p>
                  )}
                </ul>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-4">Vendas do período</h3>

              {vendas.length === 0 ? (
                <p className="text-sm text-muted">Nenhuma venda no período.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {vendas.map((venda) => (
                    <li key={venda.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-mono text-primary">
                            Venda #{venda.id}
                          </span>
                          <div className="flex items-center gap-3 text-xs text-muted">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatarDataHora(venda.dataHora)}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {venda.usuarioNome}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-primary-light text-primary-dark font-medium">
                              {LABEL_FORMA_PAGAMENTO[venda.formaPagamento]}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-semibold text-foreground whitespace-nowrap">
                            {formatarMoeda(venda.total)}
                          </span>
                          {isAdmin && (
                            <button
                              onClick={() => excluirVenda(venda.id)}
                              disabled={excluindoId === venda.id}
                              className="text-danger/60 hover:text-danger disabled:opacity-40"
                              title="Excluir venda"
                            >
                              {excluindoId === venda.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      <ul className="font-mono text-xs text-muted space-y-1 pl-1">
                        {venda.itens.map((item) => (
                          <li key={item.id} className="flex justify-between gap-2">
                            <span>
                              {item.quantidade}x {item.produtoNome}
                            </span>
                            <span>{formatarMoeda(item.subtotal)}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CardMetrica({
  icon: Icon,
  label,
  valor,
}: {
  icon: React.ElementType;
  label: string;
  valor: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="w-9 h-9 rounded-lg bg-primary-light flex items-center justify-center mb-3">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-semibold font-mono mt-1 tracking-tight">{valor}</p>
    </div>
  );
}