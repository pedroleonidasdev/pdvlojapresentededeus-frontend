"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Venda, FormaPagamento, Categoria, Produto } from "@/lib/types";
import { formatarMoeda, formatarDataHora, limiteDiaBrasiliaParaUtc, LABEL_FORMA_PAGAMENTO } from "@/lib/format";
import { imprimirCupom } from "@/lib/impressora";
import PageHeader from "@/components/PageHeader";
import EditarFormaPagamentoModal from "@/components/EditarFormaPagamentoModal";
import EditarDataHoraModal from "@/components/EditarDataHoraModal";
import { Loader2, Clock, User, Pencil, CalendarClock, Receipt, Search, Printer } from "lucide-react";

const FORMAS: FormaPagamento[] = ["PIX", "DINHEIRO", "CARTAO_CREDITO", "CARTAO_DEBITO", "MULTIPLO"];

function dataDeHoje(offsetDias = 0): string {
  const data = new Date(Date.now() + offsetDias * 24 * 60 * 60 * 1000);
  return data.toISOString().slice(0, 10);
}

/**
 * Lista as vendas mais recentes para que o operador de caixa possa corrigir a
 * forma de pagamento de uma venda feita por engano (ex: marcou Pix em vez de
 * cartão). A correção em si exige autorização de um administrador — ver
 * EditarFormaPagamentoModal. Administradores também podem corrigir a data/hora
 * da venda — ver EditarDataHoraModal. Para relatórios financeiros completos,
 * ver /relatorios.
 */
export default function VendasPage() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === "ADMIN";

  const [vendas, setVendas] = useState<Venda[]>([]);
  const [carregando, setCarregando] = useState(false);
  // só vira "true" depois do primeiro clique em Buscar — evita buscar
  // automaticamente ao abrir a tela, antes do usuário escolher o período
  const [buscou, setBuscou] = useState(false);
  const [vendaEmEdicao, setVendaEmEdicao] = useState<Venda | null>(null);
  const [vendaDataHoraEmEdicao, setVendaDataHoraEmEdicao] = useState<Venda | null>(null);

  // reimpressão do cupom de uma venda já finalizada — guarda qual venda está
  // imprimindo no momento (id) e o erro específico dela, se der problema
  const [reimprimindoId, setReimprimindoId] = useState<number | null>(null);
  const [erroReimpressao, setErroReimpressao] = useState<{ id: number; mensagem: string } | null>(null);

  async function reimprimir(venda: Venda) {
    setReimprimindoId(venda.id);
    setErroReimpressao(null);
    try {
      await imprimirCupom(venda);
    } catch (error) {
      setErroReimpressao({
        id: venda.id,
        mensagem: error instanceof Error ? error.message : "Não foi possível reimprimir o cupom.",
      });
    } finally {
      setReimprimindoId(null);
    }
  }

  // filtro de período — busca no backend. Padrão: só o dia de hoje (o
  // usuário troca a data acima se quiser ver outro período).
  const [dataInicio, setDataInicio] = useState(dataDeHoje());
  const [dataFim, setDataFim] = useState(dataDeHoje());

  // filtro de busca específica — aplicado sobre o que já foi carregado, sem nova requisição.
  const [busca, setBusca] = useState("");
  const [formaFiltro, setFormaFiltro] = useState<FormaPagamento | "TODAS">("TODAS");
  const [categoriaFiltro, setCategoriaFiltro] = useState<number | "TODAS">("TODAS");

  // a venda não traz a categoria do produto (só id/nome/qtd/preço), então
  // carregamos categorias + produtos uma vez, à parte do período buscado, só
  // pra montar o filtro e saber a que categoria cada item pertence.
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaPorProduto, setCategoriaPorProduto] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    async function carregarCategoriasEProdutos() {
      const [{ data: cats }, { data: produtos }] = await Promise.all([
        api.get<Categoria[]>("/categorias"),
        api.get<Produto[]>("/produtos"),
      ]);
      setCategorias(cats);
      setCategoriaPorProduto(new Map(
        produtos.filter((p) => p.categoria).map((p) => [p.id, p.categoria!.id])
      ));
    }
    carregarCategoriasEProdutos().catch(() => {
      // filtro de categoria é um extra — se falhar, a tela de vendas continua
      // funcionando normalmente, só sem essa opção de filtro
    });
  }, []);

  async function carregar() {
    setCarregando(true);
    try {
      // o backend espera LocalDateTime "cru" (sem milissegundos nem "Z"), no
      // mesmo formato usado em /relatorios — ver limiteDiaBrasiliaParaUtc
      const { data } = await api.get<Venda[]>("/vendas", {
        params: {
          inicio: limiteDiaBrasiliaParaUtc(dataInicio, false),
          fim: limiteDiaBrasiliaParaUtc(dataFim, true),
        },
      });
      setVendas(data);
    } finally {
      setCarregando(false);
      setBuscou(true);
    }
  }

  // Sem busca automática ao abrir a tela: o usuário escolhe o período (ou
  // mantém o padrão já preenchido) e clica em "Buscar".

  const vendasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return vendas.filter((venda) => {
      if (formaFiltro !== "TODAS" && venda.formaPagamento !== formaFiltro) return false;
      if (
        categoriaFiltro !== "TODAS" &&
        !venda.itens.some((item) => categoriaPorProduto.get(item.produtoId) === categoriaFiltro)
      ) {
        return false;
      }
      if (!termo) return true;
      const combina =
        String(venda.id).includes(termo) ||
        venda.usuarioNome.toLowerCase().includes(termo) ||
        LABEL_FORMA_PAGAMENTO[venda.formaPagamento]?.toLowerCase().includes(termo) ||
        venda.itens.some((item) => item.produtoNome.toLowerCase().includes(termo));
      return combina;
    });
  }, [vendas, busca, formaFiltro, categoriaFiltro, categoriaPorProduto]);

  return (
    <div>
      <PageHeader title="Vendas" subtitle="Consulte, filtre e corrija vendas registradas" />

      <div className="p-4 md:p-8 space-y-4">
        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Forma de pagamento</label>
              <select
                value={formaFiltro}
                onChange={(e) => setFormaFiltro(e.target.value as FormaPagamento | "TODAS")}
                className="input"
              >
                <option value="TODAS">Todas</option>
                {FORMAS.map((f) => (
                  <option key={f} value={f}>
                    {LABEL_FORMA_PAGAMENTO[f]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Categoria</label>
              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value === "TODAS" ? "TODAS" : Number(e.target.value))}
                className="input"
              >
                <option value="TODAS">Todas</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={carregar}
              disabled={carregando}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nº da venda, vendedor ou produto..."
              className="input w-full pl-9"
            />
          </div>
        </div>

        {carregando ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !buscou ? (
          <div className="text-center py-16 text-muted">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Escolha o período acima e clique em Buscar para ver as vendas.</p>
          </div>
        ) : vendasFiltradas.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma venda encontrada para esse filtro.</p>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl divide-y divide-border">
            {vendasFiltradas.map((venda) => (
              <div key={venda.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
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
                      {venda.formaPagamento === "MULTIPLO" && venda.pagamentos?.length > 0 && (
                        <span className="text-[11px]">
                          {venda.pagamentos
                            .map((p) => `${LABEL_FORMA_PAGAMENTO[p.formaPagamento]} ${formatarMoeda(p.valor)}`)
                            .join(" + ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono font-semibold text-foreground whitespace-nowrap">
                      {formatarMoeda(venda.total)}
                    </span>
                    <button
                      onClick={() => reimprimir(venda)}
                      disabled={reimprimindoId === venda.id}
                      className="text-muted hover:text-primary disabled:opacity-50"
                      title="Reimprimir cupom desta venda"
                    >
                      {reimprimindoId === venda.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Printer className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => setVendaEmEdicao(venda)}
                      className="text-muted hover:text-primary"
                      title="Editar forma de pagamento"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => setVendaDataHoraEmEdicao(venda)}
                        className="text-muted hover:text-primary"
                        title="Editar data e hora"
                      >
                        <CalendarClock className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                {erroReimpressao?.id === venda.id && (
                  <p className="mt-2 text-xs text-danger">{erroReimpressao.mensagem}</p>
                )}
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

      {vendaDataHoraEmEdicao && (
        <EditarDataHoraModal
          venda={vendaDataHoraEmEdicao}
          onFechar={() => setVendaDataHoraEmEdicao(null)}
          onSalvo={carregar}
        />
      )}
    </div>
  );
}
