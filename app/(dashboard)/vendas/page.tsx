"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Venda, FormaPagamento, Categoria, Produto } from "@/lib/types";
import { formatarMoeda, formatarDataHora, limiteDiaBrasiliaParaUtc, dataBrasiliaISO, LABEL_FORMA_PAGAMENTO } from "@/lib/format";
import { imprimirCupom } from "@/lib/impressora";
import PageHeader from "@/components/PageHeader";
import EditarFormaPagamentoModal from "@/components/EditarFormaPagamentoModal";
import EditarDataHoraModal from "@/components/EditarDataHoraModal";
import FiltroCheckbox from "@/components/FiltroCheckbox";
import { Loader2, Clock, User, Pencil, CalendarClock, Receipt, Search, Printer, Download, FileText, Eye, EyeOff, Trash2 } from "lucide-react";
import { CarregandoSecao } from "@/components/CarregamentoCatolico";

const FORMAS: FormaPagamento[] = ["PIX", "DINHEIRO", "CARTAO_CREDITO", "CARTAO_DEBITO", "MULTIPLO"];

// "hoje" no fuso de Brasília — toISOString() sozinho usa UTC e, depois das 21h
// em Brasília, já devolveria o dia seguinte
function dataDeHoje(offsetDias = 0): string {
  const data = new Date(Date.now() + offsetDias * 24 * 60 * 60 * 1000);
  return dataBrasiliaISO(data.toISOString());
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
  // useSearchParams só funciona dentro de um Suspense (exigência do Next.js
  // pra essa página poder continuar sendo pré-renderizada como estática) —
  // é assim que a tela sabe o período quando chega pelo link de Faturamento.
  return (
    <Suspense fallback={null}>
      <VendasPageConteudo />
    </Suspense>
  );
}

function VendasPageConteudo() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === "ADMIN";
  const searchParams = useSearchParams();
  const inicioDaUrl = searchParams.get("inicio");
  const fimDaUrl = searchParams.get("fim");

  const [vendas, setVendas] = useState<Venda[]>([]);
  const [carregando, setCarregando] = useState(false);
  // só vira "true" depois do primeiro clique em Buscar — evita buscar
  // automaticamente ao abrir a tela, antes do usuário escolher o período
  // (exceto quando o período já vem pronto pela URL — ver useEffect abaixo)
  const [buscou, setBuscou] = useState(false);
  const [vendaEmEdicao, setVendaEmEdicao] = useState<Venda | null>(null);
  const [vendaDataHoraEmEdicao, setVendaDataHoraEmEdicao] = useState<Venda | null>(null);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);
  const [excluindoTodas, setExcluindoTodas] = useState(false);
  const [erroLista, setErroLista] = useState<string | null>(null);

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
  const [dataInicio, setDataInicio] = useState(inicioDaUrl || dataDeHoje());
  const [dataFim, setDataFim] = useState(fimDaUrl || dataDeHoje());

  // filtro de busca específica — aplicado sobre o que já foi carregado, sem nova requisição.
  const [busca, setBusca] = useState("");
  // ativado, mascara os valores em R$ na tela (e, por consequência, também na
  // impressão — Ctrl+P imprime exatamente o que está na tela)
  const [ocultarValores, setOcultarValores] = useState(false);
  const valor = (v: number) => (ocultarValores ? "R$ ••••" : formatarMoeda(v));
  // null = "todas selecionadas" (sem filtro) — é o estado inicial, antes do
  // usuário desmarcar algo no filtro tipo Excel (ver FiltroCheckbox)
  const [formasSelecionadas, setFormasSelecionadas] = useState<Set<FormaPagamento> | null>(null);
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<Set<number> | null>(null);

  // a venda não traz a categoria do produto (só id/nome/qtd/preço), então
  // carregamos categorias + produtos uma vez, à parte do período buscado, só
  // pra montar o filtro e saber a que categoria cada item pertence.
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaPorProduto, setCategoriaPorProduto] = useState<Map<number, number>>(new Map());
  const nomeCategoriaPorId = useMemo(
    () => new Map(categorias.map((c) => [c.id, c.nome])),
    [categorias]
  );

  function nomeCategoriaDoProduto(produtoId: number): string | undefined {
    const categoriaId = categoriaPorProduto.get(produtoId);
    return categoriaId ? nomeCategoriaPorId.get(categoriaId) : undefined;
  }

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

  async function carregar(inicio: string = dataInicio, fim: string = dataFim) {
    if (inicio > fim) {
      setErroLista("A data de início é depois da data de fim. Ajuste o período e busque de novo.");
      return;
    }
    setErroLista(null);
    setCarregando(true);
    try {
      // o backend espera LocalDateTime "cru" (sem milissegundos nem "Z"), no
      // mesmo formato usado em /relatorios — ver limiteDiaBrasiliaParaUtc
      const { data } = await api.get<Venda[]>("/vendas", {
        params: {
          inicio: limiteDiaBrasiliaParaUtc(inicio, false),
          fim: limiteDiaBrasiliaParaUtc(fim, true),
        },
      });
      setVendas(data);
    } catch {
      setVendas([]);
      setErroLista("Não foi possível carregar as vendas. Verifique a conexão e tente buscar de novo.");
    } finally {
      setCarregando(false);
      setBuscou(true);
    }
  }

  // atalhos de período: preenche as datas e já busca
  function aplicarPeriodo(inicio: string, fim: string) {
    setDataInicio(inicio);
    setDataFim(fim);
    carregar(inicio, fim);
  }

  // Sem busca automática ao abrir a tela: o usuário escolhe o período (ou
  // mantém o padrão já preenchido) e clica em "Buscar" — exceto quando a
  // tela foi aberta com período na URL (vindo do link "Ver lista completa
  // de vendas" em Faturamento), aí já busca direto pra poupar um clique.
  useEffect(() => {
    if (inicioDaUrl && fimDaUrl) {
      carregar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function excluirVenda(id: number) {
    if (!confirm(`Excluir a venda #${id}? O estoque dos produtos será devolvido.`)) return;
    setExcluindoId(id);
    setErroLista(null);
    try {
      await api.delete(`/vendas/${id}`);
      await carregar();
    } catch {
      setErroLista(`Não foi possível excluir a venda #${id}. Nada foi alterado.`);
    } finally {
      setExcluindoId(null);
    }
  }

  // ATENÇÃO: isto apaga TODAS as vendas do sistema (qualquer período), não só as
  // que aparecem na tela — por isso exige digitar EXCLUIR para confirmar.
  async function excluirTodasAsVendas() {
    const resposta = window.prompt(
      "ATENÇÃO: isto apaga TODAS as vendas do sistema (de qualquer data, não só as que aparecem na tela) e devolve o estoque dos produtos vendidos. Essa ação não pode ser desfeita.\n\nPara confirmar, digite EXCLUIR:"
    );
    if (resposta === null || resposta.trim().toUpperCase() !== "EXCLUIR") return;
    setExcluindoTodas(true);
    setErroLista(null);
    try {
      await api.delete("/vendas");
      await carregar();
    } catch {
      setErroLista("Não foi possível excluir as vendas. Nada foi alterado.");
    } finally {
      setExcluindoTodas(false);
    }
  }

  function exportarExcel() {
    const linhas = vendasFiltradas.map((v) => {
      const linha: Record<string, string | number> = {
        Venda: v.id,
        "Data/Hora": formatarDataHora(v.dataHora),
        Vendedor: v.usuarioNome,
        "Forma de pagamento": v.pagamentos?.length
          ? v.pagamentos.map((p) => `${LABEL_FORMA_PAGAMENTO[p.formaPagamento]}: ${formatarMoeda(p.valor)}`).join(" + ")
          : LABEL_FORMA_PAGAMENTO[v.formaPagamento] ?? v.formaPagamento,
      };
      if (!ocultarValores) {
        linha.Desconto = v.valorDesconto ?? 0;
        linha.Total = v.total;
      }
      linha.Itens = v.itens
        .map((i) => {
          const cat = nomeCategoriaDoProduto(i.produtoId);
          return `${i.quantidade}x ${i.produtoNome}${cat ? ` (${cat})` : ""}`;
        })
        .join("; ");
      return linha;
    });

    if (!ocultarValores && linhas.length > 0) {
      linhas.push({
        Venda: "TOTAL",
        "Data/Hora": "",
        Vendedor: "",
        "Forma de pagamento": `${resumo.quantidade} venda(s)`,
        Desconto: resumo.desconto,
        Total: resumo.total,
        Itens: "",
      });
    }

    const planilha = XLSX.utils.json_to_sheet(linhas);
    const larguras: Record<string, number> = {
      Venda: 8,
      "Data/Hora": 18,
      Vendedor: 16,
      "Forma de pagamento": 22,
      Desconto: 12,
      Total: 12,
      Itens: 50,
    };
    planilha["!cols"] = Object.keys(linhas[0] ?? {}).map((chave) => ({ wch: larguras[chave] ?? 14 }));

    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, "Vendas");
    XLSX.writeFile(livro, `vendas_${dataInicio}_a_${dataFim}.xlsx`);
  }

  function exportarPdf() {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Vendas", 14, 16);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Período: ${dataInicio} a ${dataFim}`, 14, 22);

    const cabecalho = ocultarValores
      ? ["Venda", "Data/Hora", "Vendedor", "Forma", "Itens"]
      : ["Venda", "Data/Hora", "Vendedor", "Forma", "Desconto", "Total", "Itens"];

    autoTable(doc, {
      startY: 28,
      margin: { left: 14, right: 14 },
      head: [cabecalho],
      body: vendasFiltradas.map((v) => {
        const linha = [
          `#${v.id}`,
          formatarDataHora(v.dataHora),
          v.usuarioNome,
          v.pagamentos?.length
            ? v.pagamentos.map((p) => LABEL_FORMA_PAGAMENTO[p.formaPagamento]).join(" + ")
            : LABEL_FORMA_PAGAMENTO[v.formaPagamento] ?? v.formaPagamento,
        ];
        if (!ocultarValores) {
          linha.push(formatarMoeda(v.valorDesconto ?? 0));
          linha.push(formatarMoeda(v.total));
        }
        linha.push(
          v.itens
            .map((i) => {
              const cat = nomeCategoriaDoProduto(i.produtoId);
              return `${i.quantidade}x ${i.produtoNome}${cat ? ` (${cat})` : ""}`;
            })
            .join(", "),
        );
        return linha;
      }),
      foot: ocultarValores
        ? undefined
        : [["", "", "", `${resumo.quantidade} venda(s)`, formatarMoeda(resumo.desconto), formatarMoeda(resumo.total), ""]],
      showFoot: "lastPage",
      footStyles: { fillColor: [235, 245, 240], textColor: 30, fontStyle: "bold" },
      styles: { fontSize: 8 },
      headStyles: { fillColor: [34, 120, 87] },
      columnStyles: { [cabecalho.length - 1]: { cellWidth: 60 } },
    });

    doc.save(`vendas_${dataInicio}_a_${dataFim}.pdf`);
  }

  const vendasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return vendas.filter((venda) => {
      if (formasSelecionadas !== null && !formasSelecionadas.has(venda.formaPagamento)) return false;
      if (
        categoriasSelecionadas !== null &&
        !venda.itens.some((item) => categoriasSelecionadas.has(categoriaPorProduto.get(item.produtoId) ?? -1))
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
  }, [vendas, busca, formasSelecionadas, categoriasSelecionadas, categoriaPorProduto]);

  // totais do que está na tela (respeita busca e filtros). Por forma de
  // pagamento usa o detalhe dos pagamentos — assim vendas "Múltiplos" entram
  // em cada forma pelo valor realmente pago nela.
  const resumo = useMemo(() => {
    let total = 0;
    let desconto = 0;
    const porForma = new Map<string, number>();
    for (const venda of vendasFiltradas) {
      total += venda.total;
      desconto += venda.valorDesconto ?? 0;
      if (venda.pagamentos?.length) {
        for (const p of venda.pagamentos) {
          porForma.set(p.formaPagamento, (porForma.get(p.formaPagamento) ?? 0) + p.valor);
        }
      } else {
        porForma.set(venda.formaPagamento, (porForma.get(venda.formaPagamento) ?? 0) + venda.total);
      }
    }
    const quantidade = vendasFiltradas.length;
    return {
      quantidade,
      total,
      desconto,
      ticketMedio: quantidade > 0 ? total / quantidade : 0,
      porForma: Array.from(porForma.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [vendasFiltradas]);

  return (
    <div>
      <PageHeader title="Relatórios de Vendas" subtitle="Consulte, filtre e corrija vendas registradas" />

      <div className="p-4 md:p-8 space-y-4">
        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted">Período rápido:</span>
            {[
              { rotulo: "Hoje", inicio: dataDeHoje(), fim: dataDeHoje() },
              { rotulo: "Ontem", inicio: dataDeHoje(-1), fim: dataDeHoje(-1) },
              { rotulo: "Últimos 7 dias", inicio: dataDeHoje(-6), fim: dataDeHoje() },
              { rotulo: "Este mês", inicio: `${dataDeHoje().slice(0, 8)}01`, fim: dataDeHoje() },
            ].map((atalho) => (
              <button
                key={atalho.rotulo}
                type="button"
                onClick={() => aplicarPeriodo(atalho.inicio, atalho.fim)}
                disabled={carregando}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition disabled:opacity-50 ${
                  dataInicio === atalho.inicio && dataFim === atalho.fim
                    ? "bg-primary-light border-primary/30 text-primary-dark"
                    : "bg-surface border-border text-foreground hover:bg-background"
                }`}
              >
                {atalho.rotulo}
              </button>
            ))}
          </div>

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
            <FiltroCheckbox
              label="Forma de pagamento"
              opcoes={FORMAS.map((f) => ({ valor: f, rotulo: LABEL_FORMA_PAGAMENTO[f] }))}
              selecionados={formasSelecionadas}
              onChange={setFormasSelecionadas}
            />
            <FiltroCheckbox
              label="Categoria"
              opcoes={categorias.map((c) => ({ valor: c.id, rotulo: c.nome }))}
              selecionados={categoriasSelecionadas}
              onChange={setCategoriasSelecionadas}
            />
            <button
              onClick={() => carregar()}
              disabled={carregando}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar
            </button>

            {buscou && vendasFiltradas.length > 0 && (
              <>
                <button
                  onClick={() => setOcultarValores((v) => !v)}
                  title="Oculta os valores em R$ na tela — útil pra imprimir a lista sem mostrar os valores"
                  className={`flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg border transition ${
                    ocultarValores
                      ? "bg-primary-light border-primary/30 text-primary-dark"
                      : "bg-surface border-border text-foreground hover:bg-background"
                  }`}
                >
                  {ocultarValores ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {ocultarValores ? "Valores ocultos" : "Ocultar valores"}
                </button>
                <button
                  onClick={exportarExcel}
                  className="flex items-center gap-2 bg-accent hover:bg-accent-dark text-white text-sm font-medium px-4 py-2.5 rounded-lg transition"
                >
                  <Download className="w-4 h-4" />
                  Excel
                </button>
                <button
                  onClick={exportarPdf}
                  className="flex items-center gap-2 bg-secondary hover:bg-secondary-dark text-white text-sm font-medium px-4 py-2.5 rounded-lg transition"
                >
                  <FileText className="w-4 h-4" />
                  PDF
                </button>
                {isAdmin && vendas.length > 0 && (
                  <button
                    onClick={excluirTodasAsVendas}
                    disabled={excluindoTodas}
                    className="flex items-center gap-2 bg-danger/10 hover:bg-danger/20 text-danger text-sm font-medium px-4 py-2.5 rounded-lg transition disabled:opacity-60"
                  >
                    {excluindoTodas ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Apagar todas do sistema
                  </button>
                )}
              </>
            )}
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

        {erroLista && (
          <div className="rounded-lg bg-danger-light text-danger text-sm px-4 py-3">{erroLista}</div>
        )}

        {buscou && !carregando && !erroLista && vendasFiltradas.length > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <CardResumo rotulo="Vendas" texto={String(resumo.quantidade)} />
              <CardResumo rotulo="Total vendido" texto={valor(resumo.total)} destaque />
              <CardResumo rotulo="Ticket médio" texto={valor(resumo.ticketMedio)} />
              <CardResumo rotulo="Descontos dados" texto={valor(resumo.desconto)} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-muted">Por forma de pagamento:</span>
              {resumo.porForma.map(([forma, soma]) => (
                <span
                  key={forma}
                  className="px-2.5 py-1 rounded-full bg-primary-light text-primary-dark font-medium"
                >
                  {LABEL_FORMA_PAGAMENTO[forma] ?? forma}: {valor(soma)}
                </span>
              ))}
            </div>
            {categoriasSelecionadas !== null && (
              <p className="text-[11px] text-muted">
                Com filtro de categoria, os totais consideram o valor inteiro das vendas que têm algum item dessa categoria.
              </p>
            )}
          </div>
        )}

        {carregando ? (
          <CarregandoSecao />
        ) : !buscou ? (
          <div className="text-center py-16 text-muted">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Escolha o período acima e clique em Buscar para ver as vendas.</p>
          </div>
        ) : erroLista ? null : vendasFiltradas.length === 0 ? (
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
                            .map((p) => `${LABEL_FORMA_PAGAMENTO[p.formaPagamento]} ${valor(p.valor)}`)
                            .join(" + ")}
                        </span>
                      )}
                      {(venda.valorDesconto ?? 0) > 0 && (
                        <span className="text-[11px] text-accent-dark">
                          Desconto {valor(venda.valorDesconto ?? 0)}
                          {venda.percentualDesconto ? ` (${venda.percentualDesconto}%)` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono font-semibold text-foreground whitespace-nowrap">
                      {valor(venda.total)}
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
                <p className="mt-2 text-xs text-foreground/70 leading-relaxed">
                  {venda.itens.map((item, i) => {
                    const nomeCategoria = nomeCategoriaDoProduto(item.produtoId);
                    return (
                      <span key={item.id}>
                        {i > 0 && ", "}
                        <span className="font-medium">{item.quantidade}x</span> {item.produtoNome}
                        {nomeCategoria && <span className="text-muted"> ({nomeCategoria})</span>}
                      </span>
                    );
                  })}
                </p>
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
          onSalvo={() => carregar()}
        />
      )}

      {vendaDataHoraEmEdicao && (
        <EditarDataHoraModal
          venda={vendaDataHoraEmEdicao}
          onFechar={() => setVendaDataHoraEmEdicao(null)}
          onSalvo={() => carregar()}
        />
      )}
    </div>
  );
}

function CardResumo({ rotulo, texto, destaque }: { rotulo: string; texto: string; destaque?: boolean }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        destaque ? "bg-primary-light border-primary/30" : "bg-surface border-border"
      }`}
    >
      <p className="text-[11px] font-medium text-muted">{rotulo}</p>
      <p className={`mt-0.5 font-mono font-semibold ${destaque ? "text-primary-dark text-lg" : "text-foreground"}`}>
        {texto}
      </p>
    </div>
  );
}
