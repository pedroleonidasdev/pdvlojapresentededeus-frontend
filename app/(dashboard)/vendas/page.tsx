"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Venda } from "@/lib/types";
import { formatarMoeda, formatarDataHora, LABEL_FORMA_PAGAMENTO } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import EditarFormaPagamentoModal from "@/components/EditarFormaPagamentoModal";
import { Loader2, Clock, User, Pencil, Receipt } from "lucide-react";

/**
 * Lista as vendas mais recentes para que o operador de caixa possa corrigir a
 * forma de pagamento de uma venda feita por engano (ex: marcou Pix em vez de
 * cartão). A correção em si exige autorização de um administrador — ver
 * EditarFormaPagamentoModal. Para relatórios financeiros completos, ver /relatorios.
 */
export default function VendasPage() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [vendaEmEdicao, setVendaEmEdicao] = useState<Venda | null>(null);

  async function carregar() {
    setCarregando(true);
    try {
      const hoje = new Date();
      const seteDiasAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
      // o backend espera LocalDateTime "cru" (sem milissegundos nem "Z"), no
      // mesmo formato usado em /relatorios — ver limiteDiaBrasiliaParaUtc
      const { data } = await api.get<Venda[]>("/vendas", {
        params: {
          inicio: seteDiasAtras.toISOString().slice(0, 19),
          fim: hoje.toISOString().slice(0, 19),
        },
      });
      setVendas(data);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <div>
      <PageHeader title="Vendas" subtitle="Últimos 7 dias — correção de forma de pagamento" />

      <div className="p-4 md:p-8">
        {carregando ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : vendas.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma venda nos últimos 7 dias.</p>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl divide-y divide-border">
            {vendas.map((venda) => (
              <div key={venda.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-mono text-primary">Venda #{venda.id}</span>
                  <div className="flex items-center gap-3 text-xs text-muted flex-wrap">
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
                  <button
                    onClick={() => setVendaEmEdicao(venda)}
                    className="text-muted hover:text-primary"
                    title="Editar forma de pagamento"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {vendaEmEdicao && (
        <EditarFormaPagamentoModal
          venda={vendaEmEdicao}
          onFechar={() => setVendaEmEdicao(null)}
          onSalvo={carregar}
        />
      )}
    </div>
  );
}
