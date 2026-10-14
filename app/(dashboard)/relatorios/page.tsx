"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Venda, FormaPagamento, Caixa, Troca, Despesa } from "@/lib/types";
import {
  formatarMoeda,
  formatarDataHora,
  dataBrasiliaISO,
  limiteDiaBrasiliaParaUtc,
  LABEL_FORMA_PAGAMENTO,
} from "@/lib/format";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import ConfirmarFechamentoCaixaModal from "@/components/ConfirmarFechamentoCaixaModal";
import { CarregandoSecao } from "@/components/CarregamentoCatolico";
import {
  Loader2,
  TrendingUp,
  Receipt,
  Wallet,
  Clock,
  User,
  Download,
  Filter,
  Lock,
  Unlock,
  Vault,
  Repeat,
  RotateCcw,
  FileText,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
  Trophy,
} from "lucide-react";

const FORMAS: FormaPagamento[] = ["PIX", "DINHEIRO", "CARTAO_CREDITO", "CARTAO_DEBITO"];

// cor de cada forma de pagamento nas barras de "Por forma de pagamento"
const COR_FORMA: Record<string, string> = {
  PIX: "bg-info",
  DINHEIRO: "bg-success",
  CARTAO_CREDITO: "bg-secondary",
  CARTAO_DEBITO: "bg-accent",
};

function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

function diasEntre(inicio: string, fim: string): number {
  const [a1, m1, d1] = inicio.split("-").map(Number);
  const [a2, m2, d2] = fim.split("-").map(Number);
  const dias = Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000) + 1;
  return Math.max(1, dias);
}

/** Período imediatamente anterior, com o mesmo número de dias (para comparar). */
function periodoAnterior(inicio: string, fim: string) {
  const dias = diasEntre(inicio, fim);
  const fimAnt = somarDias(inicio, -1);
  return { inicio: somarDias(fimAnt, -(dias - 1)), fim: fimAnt };
}

function dataCurta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function filtrarVendas(vendas: Venda[], formas: Set<FormaPagamento>, usuario: string): Venda[] {
  return vendas.filter((v) => {
    const formasDaVenda = v.pagamentos?.length ? v.pagamentos.map((p) => p.formaPagamento) : [v.formaPagamento];
    if (!formasDaVenda.some((forma) => formas.has(forma))) return false;
    if (usuario !== "TODOS" && v.usuarioNome !== usuario) return false;
    return true;
  });
}

function filtrarTrocas(trocas: Troca[], formas: Set<FormaPagamento>, usuario: string): Troca[] {
  return trocas.filter((t) => {
    if (t.formaPagamentoDiferenca && !formas.has(t.formaPagamentoDiferenca)) return false;
    if (usuario !== "TODOS" && t.usuarioNome !== usuario) return false;
    return true;
  });
}

export default function RelatoriosPage() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === "ADMIN";

  // "hoje" no fuso de Brasília (toISOString() usaria UTC e viraria o dia à noite)
  const hojeISO = dataBrasiliaISO(new Date().toISOString());

  const [inicio, setInicio] = useState(`${hojeISO.slice(0, 8)}01`);
  const [fim, setFim] = useState(hojeISO);
  // período já carregado + vendas/trocas do período anterior (para o comparativo)
  const [periodoGerado, setPeriodoGerado] = useState<{ inicio: string; fim: string } | null>(null);
  const [vendasAnt, setVendasAnt] = useState<Venda[] | null>(null);
  const [trocasAnt, setTrocasAnt] = useState<Troca[] | null>(null);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [trocas, setTrocas] = useState<Troca[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [jaGerou, setJaGerou] = useState(false);

  // caixa aberto no momento (independe do período filtrado)
  const [caixaAtual, setCaixaAtual] = useState<Caixa | null | undefined>(undefined);
  // histórico de aberturas/fechamentos de caixa dentro do período filtrado
  const [historicoCaixas, setHistoricoCaixas] = useState<Caixa[]>([]);
  // fechamento do caixa atual (somente ADMIN)
  const [valorFinalCaixa, setValorFinalCaixa] = useState<string>("");
  const [fechandoCaixa, setFechandoCaixa] = useState(false);
  const [erroFechamento, setErroFechamento] = useState<string | null>(null);
  // exige confirmação explícita (valor em espécie, não faturamento) antes de fechar
  const [confirmandoFechamento, setConfirmandoFechamento] = useState(false);

  useEffect(() => {
    async function buscarCaixaAtual() {
      try {
        const { data, status } = await api.get<Caixa>("/caixa/atual");
        setCaixaAtual(status === 204 || !data || !("id" in data) ? null : data);
      } catch {
        setCaixaAtual(null);
      }
    }
    buscarCaixaAtual();
  }, []);

  async function fecharCaixa() {
    setFechandoCaixa(true);
    setErroFechamento(null);
    try {
      await api.post("/caixa/fechar", {
        valorFinal: Number(valorFinalCaixa.replace(",", ".")) || 0,
      });
      setCaixaAtual(null);
      setValorFinalCaixa("");
      setConfirmandoFechamento(false);
      // se já havia um relatório gerado, atualiza o histórico de caixas exibido
      if (jaGerou) await gerar();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Não foi possível fechar o caixa.";
      setErroFechamento(msg);
    } finally {
      setFechandoCaixa(false);
    }
  }

  // filtros aplicados sobre o período já carregado
  const [formasSelecionadas, setFormasSelecionadas] = useState<Set<FormaPagamento>>(
    new Set(FORMAS)
  );
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<string>("TODOS");

  async function gerar(inicioPeriodo: string = inicio, fimPeriodo: string = fim) {
    setCarregando(true);
    try {
      const params = {
        inicio: limiteDiaBrasiliaParaUtc(inicioPeriodo, false),
        fim: limiteDiaBrasiliaParaUtc(fimPeriodo, true),
      };
      const anterior = periodoAnterior(inicioPeriodo, fimPeriodo);
      const paramsAnt = {
        inicio: limiteDiaBrasiliaParaUtc(anterior.inicio, false),
        fim: limiteDiaBrasiliaParaUtc(anterior.fim, true),
      };
      const [resVendas, resCaixas, resTrocas, resDespesas, resVendasAnt, resTrocasAnt] = await Promise.all([
        api.get<Venda[]>("/vendas", { params }),
        api.get<Caixa[]>("/caixa", { params }),
        api.get<Troca[]>("/trocas", { params }),
        api.get<Despesa[]>("/despesas", { params }),
        // o comparativo é um extra: se falhar, o relatório continua sem ele
        api.get<Venda[]>("/vendas", { params: paramsAnt }).catch(() => null),
        api.get<Troca[]>("/trocas", { params: paramsAnt }).catch(() => null),
      ]);
      setPeriodoGerado({ inicio: inicioPeriodo, fim: fimPeriodo });
      setVendasAnt(resVendasAnt?.data ?? null);
      setTrocasAnt(resTrocasAnt?.data ?? null);
      setVendas(resVendas.data);
      setHistoricoCaixas(resCaixas.data);
      setTrocas(resTrocas.data);
      setDespesas(resDespesas.data);
      setJaGerou(true);
      // ao gerar um novo período, reseta os filtros locais
      setFormasSelecionadas(new Set(FORMAS));
      setUsuarioSelecionado("TODOS");
    } finally {
      setCarregando(false);
    }
  }

  // atalhos de período: preenche as datas e já gera o relatório
  const atalhos = useMemo(() => {
    const [ano, mes] = hojeISO.split("-").map(Number);
    const primeiroMesPassado = new Date(Date.UTC(ano, mes - 2, 1)).toISOString().slice(0, 10);
    const ultimoMesPassado = somarDias(`${hojeISO.slice(0, 8)}01`, -1);
    return [
      { rotulo: "Hoje", inicio: hojeISO, fim: hojeISO },
      { rotulo: "Últimos 7 dias", inicio: somarDias(hojeISO, -6), fim: hojeISO },
      { rotulo: "Este mês", inicio: `${hojeISO.slice(0, 8)}01`, fim: hojeISO },
      { rotulo: "Mês passado", inicio: primeiroMesPassado, fim: ultimoMesPassado },
    ];
  }, [hojeISO]);

  function aplicarAtalho(i: string, f: string) {
    setInicio(i);
    setFim(f);
    gerar(i, f);
  }

  const usuariosDoPeriodo = useMemo(() => {
    const nomes = new Set([
      ...vendas.map((v) => v.usuarioNome),
      ...trocas.map((t) => t.usuarioNome),
    ]);
    return Array.from(nomes).sort();
  }, [vendas, trocas]);

  function alternarForma(forma: FormaPagamento) {
    setFormasSelecionadas((prev) => {
      const novo = new Set(prev);
      if (novo.has(forma)) {
        novo.delete(forma);
      } else {
        novo.add(forma);
      }
      return novo;
    });
  }

  const vendasFiltradas = useMemo(
    () => filtrarVendas(vendas, formasSelecionadas, usuarioSelecionado),
    [vendas, formasSelecionadas, usuarioSelecionado]
  );

  // trocas sem diferença (formaPagamentoDiferenca nula) sempre entram — não têm
  // forma de pagamento pra filtrar. As com diferença seguem o mesmo filtro das vendas.
  const trocasFiltradas = useMemo(
    () => filtrarTrocas(trocas, formasSelecionadas, usuarioSelecionado),
    [trocas, formasSelecionadas, usuarioSelecionado]
  );

  // comparativo com o período anterior (mesmos filtros aplicados)
  const comparativo = useMemo(() => {
    if (!vendasAnt || !trocasAnt) return null;
    const v = filtrarVendas(vendasAnt, formasSelecionadas, usuarioSelecionado);
    const t = filtrarTrocas(trocasAnt, formasSelecionadas, usuarioSelecionado);
    const total = v.reduce((acc, x) => acc + x.total, 0) + t.reduce((acc, x) => acc + x.diferenca, 0);
    return { total, quantidadeVendas: v.length };
  }, [vendasAnt, trocasAnt, formasSelecionadas, usuarioSelecionado]);

  // métricas calculadas a partir do que está filtrado, garantindo consistência
  // entre os cards, o gráfico e a lista de vendas exibida
  const metricas = useMemo(() => {
    const totalFaturado = vendasFiltradas.reduce((acc, v) => acc + v.total, 0);
    const quantidadeVendas = vendasFiltradas.length;

    // diferença de troca: positiva = cliente pagou a mais (entra dinheiro),
    // negativa = loja devolveu troco (sai dinheiro) — soma líquida das duas.
    const totalTrocas = trocasFiltradas.reduce((acc, t) => acc + t.diferenca, 0);
    const quantidadeTrocas = trocasFiltradas.length;
    const totalLiquido = totalFaturado + totalTrocas;

    const totalPorFormaPagamento: Record<string, number> = {};
    for (const v of vendasFiltradas) {
      if (v.pagamentos?.length) {
        for (const pagamento of v.pagamentos) {
          totalPorFormaPagamento[pagamento.formaPagamento] =
            (totalPorFormaPagamento[pagamento.formaPagamento] ?? 0) + pagamento.valor;
        }
      } else {
        totalPorFormaPagamento[v.formaPagamento] =
          (totalPorFormaPagamento[v.formaPagamento] ?? 0) + v.total;
      }
    }
    for (const t of trocasFiltradas) {
      if (!t.formaPagamentoDiferenca || t.diferenca === 0) continue;
      totalPorFormaPagamento[t.formaPagamentoDiferenca] =
        (totalPorFormaPagamento[t.formaPagamentoDiferenca] ?? 0) + t.diferenca;
    }

    const produtosMap = new Map<string, { quantidadeVendida: number; totalVendido: number }>();
    for (const v of vendasFiltradas) {
      for (const item of v.itens) {
        const atual = produtosMap.get(item.produtoNome) ?? {
          quantidadeVendida: 0,
          totalVendido: 0,
        };
        atual.quantidadeVendida += item.quantidade;
        atual.totalVendido += item.subtotal;
        produtosMap.set(item.produtoNome, atual);
      }
    }
    const produtosMaisVendidos = Array.from(produtosMap.entries())
      .map(([nome, dados]) => ({ nome, ...dados }))
      .sort((a, b) => b.quantidadeVendida - a.quantidadeVendida)
      .slice(0, 10);

    return {
      totalFaturado,
      quantidadeVendas,
      totalTrocas,
      quantidadeTrocas,
      totalLiquido,
      totalPorFormaPagamento,
      produtosMaisVendidos,
    };
  }, [vendasFiltradas, trocasFiltradas]);

  // agrupamento por dia (no fuso de Brasília) para o gráfico
  const vendasPorDia = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const v of vendasFiltradas) {
      const dia = dataBrasiliaISO(v.dataHora);
      mapa.set(dia, (mapa.get(dia) ?? 0) + v.total);
    }
    return Array.from(mapa.entries())
      .map(([dia, total]) => ({ dia, total }))
      .sort((a, b) => a.dia.localeCompare(b.dia));
  }, [vendasFiltradas]);

  const maiorValorDia = useMemo(
    () => Math.max(1, ...vendasPorDia.map((d) => d.total)),
    [vendasPorDia]
  );

  const diasPeriodo = periodoGerado ? diasEntre(periodoGerado.inicio, periodoGerado.fim) : 1;
  const mediaPorDia = metricas.totalFaturado / diasPeriodo;
  const melhorDia = useMemo(
    () => vendasPorDia.reduce<{ dia: string; total: number } | null>((m, d) => (!m || d.total > m.total ? d : m), null),
    [vendasPorDia]
  );
  const variacaoPct =
    comparativo && comparativo.total > 0 ? ((metricas.totalLiquido - comparativo.total) / comparativo.total) * 100 : null;
  const formasOrdenadas = useMemo(() => {
    const itens = Object.entries(metricas.totalPorFormaPagamento).sort((a, b) => b[1] - a[1]);
    const base = itens.reduce((acc, [, v]) => acc + Math.max(v, 0), 0);
    return { itens, base };
  }, [metricas.totalPorFormaPagamento]);

  // conferência de cada caixa: quanto em dinheiro entrou (vendas + trocas + suprimento)
  // e saiu (sangria + despesas pagas em dinheiro) durante a janela em que ele ficou
  // aberto, comparado com o valor final informado no fechamento.
  const conferenciaCaixas = useMemo(() => {
    const mapa = new Map<
      number,
      {
        vendasDinheiro: number;
        trocasDinheiro: number;
        suprimentos: number;
        saidasDinheiro: number; // sangria + despesa paga em dinheiro
        saldoEsperado: number;
        diferencaAbertura: number | null;
        diferencaEsperado: number | null;
      }
    >();

    for (const caixa of historicoCaixas) {
      const inicioMs = new Date(caixa.dataAbertura).getTime();
      const fimMs = caixa.dataFechamento ? new Date(caixa.dataFechamento).getTime() : Date.now();
      const dentro = (dataHora: string) => {
        const t = new Date(dataHora).getTime();
        return t >= inicioMs && t <= fimMs;
      };

      const vendasDinheiro = vendas
        .filter((v) => dentro(v.dataHora))
        .reduce((acc, v) => {
          if (v.pagamentos?.length) {
            return acc + v.pagamentos
              .filter((p) => p.formaPagamento === "DINHEIRO")
              .reduce((soma, p) => soma + p.valor, 0);
          }
          return acc + (v.formaPagamento === "DINHEIRO" ? v.total : 0);
        }, 0);

      const trocasDinheiro = trocas
        .filter((t) => t.formaPagamentoDiferenca === "DINHEIRO" && dentro(t.dataHora))
        .reduce((acc, t) => acc + t.diferenca, 0);

      // despesas já vêm vinculadas ao caixa exato (caixaId) quando são em dinheiro,
      // então usamos o vínculo direto em vez da janela de tempo — é mais preciso
      const despesasDoCaixa = despesas.filter((d) => d.caixaId === caixa.id);
      const suprimentos = despesasDoCaixa
        .filter((d) => d.tipo === "SUPRIMENTO")
        .reduce((acc, d) => acc + d.valor, 0);
      const saidasDinheiro = despesasDoCaixa
        .filter((d) => d.tipo === "SANGRIA" || d.tipo === "DESPESA")
        .reduce((acc, d) => acc + d.valor, 0);

      const saldoEsperado =
        caixa.valorInicial + vendasDinheiro + trocasDinheiro + suprimentos - saidasDinheiro;
      const diferencaAbertura = caixa.valorFinal !== null ? caixa.valorFinal - caixa.valorInicial : null;
      const diferencaEsperado = caixa.valorFinal !== null ? caixa.valorFinal - saldoEsperado : null;

      mapa.set(caixa.id, {
        vendasDinheiro,
        trocasDinheiro,
        suprimentos,
        saidasDinheiro,
        saldoEsperado,
        diferencaAbertura,
        diferencaEsperado,
      });
    }
    return mapa;
  }, [historicoCaixas, vendas, trocas, despesas]);

  function exportarExcel() {
    const linhas = vendasFiltradas.map((v) => ({
      Venda: v.id,
      "Data/Hora": formatarDataHora(v.dataHora),
      Vendedor: v.usuarioNome,
      "Forma de pagamento": v.pagamentos?.length
        ? v.pagamentos.map((p) => `${LABEL_FORMA_PAGAMENTO[p.formaPagamento]}: ${formatarMoeda(p.valor)}`).join(" + ")
        : LABEL_FORMA_PAGAMENTO[v.formaPagamento] ?? v.formaPagamento,
      Subtotal: v.subtotal ?? v.total,
      Desconto: v.valorDesconto ?? 0,
      Total: v.total,
      Itens: v.itens.map((i) => `${i.quantidade}x ${i.produtoNome}`).join("; "),
    }));

    const planilha = XLSX.utils.json_to_sheet(linhas);
    planilha["!cols"] = [
      { wch: 8 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 50 },
    ];

    const linhasTrocas = trocasFiltradas.map((t) => ({
      Troca: t.id,
      "Data/Hora": formatarDataHora(t.dataHora),
      Vendedor: t.usuarioNome,
      "Venda de origem": t.vendaOrigemId ?? "",
      "Valor devolvido": t.valorDevolvido,
      "Valor novo": t.valorNovo,
      Diferença: t.diferenca,
      "Forma de pagamento da diferença": t.formaPagamentoDiferenca
        ? LABEL_FORMA_PAGAMENTO[t.formaPagamentoDiferenca]
        : "",
      "Itens devolvidos": t.itensDevolvidos.map((i) => `${i.quantidade}x ${i.produtoNome}`).join("; "),
      "Itens novos": t.itensNovos.map((i) => `${i.quantidade}x ${i.produtoNome}`).join("; "),
    }));

    const planilhaTrocas = XLSX.utils.json_to_sheet(linhasTrocas);
    planilhaTrocas["!cols"] = [
      { wch: 8 },
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 26 },
      { wch: 40 },
      { wch: 40 },
    ];

    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, "Vendas");
    XLSX.utils.book_append_sheet(livro, planilhaTrocas, "Trocas");
    XLSX.writeFile(livro, `relatorio-vendas_${inicio}_a_${fim}.xlsx`);
  }

  function exportarPdf() {
    const doc = new jsPDF();
    const margem = 14;
    let y = 16;

    doc.setFontSize(14);
    doc.text("Relatório de vendas", margem, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Período: ${inicio} a ${fim}`, margem, y);
    y += 8;

    // resumo em cards de texto
    doc.setTextColor(0);
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem },
      theme: "grid",
      head: [["Faturamento líquido", "Vendas", "Trocas", "Ticket médio"]],
      body: [[
        formatarMoeda(metricas.totalLiquido),
        metricas.quantidadeVendas.toString(),
        metricas.quantidadeTrocas.toString(),
        formatarMoeda(
          metricas.quantidadeVendas > 0 ? metricas.totalFaturado / metricas.quantidadeVendas : 0
        ),
      ]],
      styles: { halign: "center", fontSize: 9 },
      headStyles: { fillColor: [34, 120, 87] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

    if (Object.keys(metricas.totalPorFormaPagamento).length > 0) {
      doc.setFontSize(11);
      doc.text("Por forma de pagamento", margem, y);
      autoTable(doc, {
        startY: y + 3,
        margin: { left: margem, right: margem },
        head: [["Forma de pagamento", "Total"]],
        body: Object.entries(metricas.totalPorFormaPagamento).map(([forma, valor]) => [
          LABEL_FORMA_PAGAMENTO[forma] ?? forma,
          formatarMoeda(valor),
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [34, 120, 87] },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    if (metricas.produtosMaisVendidos.length > 0) {
      doc.setFontSize(11);
      doc.text("Produtos mais vendidos", margem, y);
      autoTable(doc, {
        startY: y + 3,
        margin: { left: margem, right: margem },
        head: [["#", "Produto", "Qtd.", "Total vendido"]],
        body: metricas.produtosMaisVendidos.map((p, idx) => [
          (idx + 1).toString(),
          p.nome,
          p.quantidadeVendida.toString(),
          formatarMoeda(p.totalVendido),
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [34, 120, 87] },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    if (vendasFiltradas.length > 0) {
      doc.addPage();
      y = 16;
      doc.setFontSize(12);
      doc.text("Vendas do período", margem, y);
      autoTable(doc, {
        startY: y + 4,
        margin: { left: margem, right: margem },
        head: [["Venda", "Data/Hora", "Vendedor", "Forma", "Total"]],
        body: vendasFiltradas.map((v) => [
          `#${v.id}`,
          formatarDataHora(v.dataHora),
          v.usuarioNome,
          v.pagamentos?.length
            ? v.pagamentos.map((p) => LABEL_FORMA_PAGAMENTO[p.formaPagamento]).join(" + ")
            : LABEL_FORMA_PAGAMENTO[v.formaPagamento] ?? v.formaPagamento,
          formatarMoeda(v.total),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [34, 120, 87] },
      });
    }

    doc.save(`relatorio-vendas_${inicio}_a_${fim}.pdf`);
  }

  return (
    <div>
      <PageHeader title="Faturamento" subtitle="Faturamento e desempenho de vendas por período" />

      <div className="p-4 md:p-8 space-y-6">
        {/* caixa aberto no momento, em destaque, independente do período filtrado */}
        {caixaAtual !== undefined && (
          <div
            className={`flex flex-wrap items-center gap-4 rounded-xl border p-4 ${
              caixaAtual
                ? "bg-primary-light border-primary/30"
                : "bg-danger-light border-danger/30"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                caixaAtual ? "bg-primary text-white" : "bg-danger text-white"
              }`}
            >
              {caixaAtual ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            {caixaAtual ? (
              <>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                  <div>
                    <p className="text-[11px] text-primary-dark/70 uppercase tracking-wide font-medium">
                      Caixa aberto — saldo inicial
                    </p>
                    <p className="text-lg font-semibold font-mono text-primary-dark">
                      {formatarMoeda(caixaAtual.valorInicial)}
                    </p>
                  </div>
                  <div className="text-xs text-primary-dark/80 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    Aberto por {caixaAtual.usuarioAberturaNome}
                  </div>
                  <div className="text-xs text-primary-dark/80 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {formatarDataHora(caixaAtual.dataAbertura)}
                  </div>
                </div>

                {isAdmin && (
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <input
                      inputMode="decimal"
                      value={valorFinalCaixa}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "" || /^[0-9]*[.,]?[0-9]*$/.test(v)) setValorFinalCaixa(v);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && valorFinalCaixa !== "" && setConfirmandoFechamento(true)}
                      placeholder="Dinheiro contado"
                      title="Só o dinheiro em espécie contado na gaveta — não é o faturamento do dia"
                      className="w-36 px-3 py-2 rounded-lg border border-primary/30 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                    />
                    <button
                      onClick={() => setConfirmandoFechamento(true)}
                      disabled={fechandoCaixa || valorFinalCaixa === ""}
                      className="flex items-center gap-2 bg-primary-dark hover:bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
                    >
                      {fechandoCaixa && <Loader2 className="w-4 h-4 animate-spin" />}
                      Fechar caixa
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-danger font-medium">Nenhum caixa aberto no momento.</p>
            )}
          </div>
        )}

        {erroFechamento && (
          <div className="rounded-lg bg-danger-light text-danger text-xs px-3 py-2">
            {erroFechamento}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3 bg-surface border border-border rounded-xl p-4">
          <div className="basis-full flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted mr-1">
              <CalendarDays className="w-3.5 h-3.5" />
              Período rápido
            </span>
            {atalhos.map((a) => {
              const ativo = periodoGerado?.inicio === a.inicio && periodoGerado?.fim === a.fim;
              return (
                <button
                  key={a.rotulo}
                  type="button"
                  disabled={carregando}
                  onClick={() => aplicarAtalho(a.inicio, a.fim)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition disabled:opacity-60 ${
                    ativo
                      ? "border-info bg-info text-white font-medium"
                      : "border-border text-foreground hover:border-info hover:bg-info-light"
                  }`}
                >
                  {a.rotulo}
                </button>
              );
            })}
          </div>
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
            onClick={() => gerar()}
            disabled={carregando}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-60 h-fit"
          >
            {carregando && <Loader2 className="w-4 h-4 animate-spin" />}
            Gerar relatório
          </button>

          {jaGerou && vendasFiltradas.length > 0 && (
            <button
              onClick={exportarExcel}
              className="flex items-center gap-2 bg-accent hover:bg-accent-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition h-fit"
            >
              <Download className="w-4 h-4" />
              Exportar Excel
            </button>
          )}

          {jaGerou && vendasFiltradas.length > 0 && (
            <button
              onClick={exportarPdf}
              className="flex items-center gap-2 bg-secondary hover:bg-secondary-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition h-fit"
            >
              <FileText className="w-4 h-4" />
              Exportar PDF
            </button>
          )}

          {jaGerou && vendasFiltradas.length > 0 && (
            <Link
              href={`/vendas?inicio=${inicio}&fim=${fim}`}
              className="ml-auto flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-border text-foreground hover:bg-background transition h-fit"
            >
              Ver lista completa de vendas
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {carregando && <CarregandoSecao mensagem="Gerando relatório…" />}

        {!jaGerou && !carregando && (
          <div className="flex flex-col items-center text-center gap-2 bg-surface border border-dashed border-border rounded-xl px-6 py-14">
            <div className="w-12 h-12 rounded-full bg-info-light text-info flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <p className="font-medium">Escolha um período para ver o faturamento</p>
            <p className="text-sm text-muted max-w-sm">
              Use um dos atalhos acima ou defina as datas e clique em &quot;Gerar relatório&quot;.
            </p>
          </div>
        )}

        {jaGerou && !carregando && (
          <>
            {/* filtros locais sobre o período já carregado */}
            <div className="flex flex-wrap items-center gap-4 bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-muted">
                <Filter className="w-3.5 h-3.5" />
                Filtros
              </div>

              <div className="flex flex-wrap gap-2">
                {FORMAS.map((forma) => {
                  const ativo = formasSelecionadas.has(forma);
                  return (
                    <button
                      key={forma}
                      onClick={() => alternarForma(forma)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                        ativo
                          ? "border-primary bg-primary-light text-primary-dark font-medium"
                          : "border-border text-muted hover:border-primary/40"
                      }`}
                    >
                      {LABEL_FORMA_PAGAMENTO[forma]}
                    </button>
                  );
                })}
              </div>

              <div className="ml-auto flex items-center gap-2">
                <label className="text-xs text-muted">Vendedor</label>
                <select
                  value={usuarioSelecionado}
                  onChange={(e) => setUsuarioSelecionado(e.target.value)}
                  className="input w-auto"
                >
                  <option value="TODOS">Todos</option>
                  {usuariosDoPeriodo.map((nome) => (
                    <option key={nome} value={nome}>
                      {nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* destaque: faturamento líquido + comparativo com o período anterior */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-dark via-primary to-info-dark text-white p-5 sm:p-6 shadow-lg shadow-primary/20">
              <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-accent/20 blur-3xl" />
              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-white/70 font-medium">
                    <TrendingUp className="w-4 h-4 text-accent" />
                    Faturamento líquido
                  </p>
                  <p className="mt-2 text-3xl sm:text-4xl font-semibold font-mono tracking-tight">
                    {formatarMoeda(metricas.totalLiquido)}
                  </p>
                  {metricas.totalTrocas !== 0 && (
                    <p className="mt-1 text-xs text-white/70">
                      {formatarMoeda(metricas.totalFaturado)} em vendas {metricas.totalTrocas > 0 ? "+" : "−"}{" "}
                      {formatarMoeda(Math.abs(metricas.totalTrocas))} em trocas
                    </p>
                  )}
                  {periodoGerado && (
                    <p className="mt-1 text-xs text-white/60">
                      {periodoGerado.inicio === periodoGerado.fim
                        ? dataCurta(periodoGerado.inicio)
                        : `${dataCurta(periodoGerado.inicio)} a ${dataCurta(periodoGerado.fim)}`}
                      {" · "}
                      {diasPeriodo} {diasPeriodo === 1 ? "dia" : "dias"}
                    </p>
                  )}
                </div>

                {comparativo && periodoGerado && (
                  <div className="rounded-xl bg-white/10 ring-1 ring-white/15 px-4 py-3 text-right">
                    <p className="text-[11px] uppercase tracking-wide text-white/60">vs. período anterior</p>
                    {variacaoPct !== null ? (
                      <p
                        className={`mt-0.5 flex items-center justify-end gap-1 text-xl font-semibold font-mono ${
                          variacaoPct >= 0 ? "text-emerald-300" : "text-red-300"
                        }`}
                      >
                        {variacaoPct >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                        {Math.abs(variacaoPct).toFixed(1).replace(".", ",")}%
                      </p>
                    ) : (
                      <p className="mt-0.5 text-sm text-white/80">Sem dados para comparar</p>
                    )}
                    <p className="text-[11px] text-white/60">
                      {formatarMoeda(comparativo.total)} em{" "}
                      {(() => {
                        const ant = periodoAnterior(periodoGerado.inicio, periodoGerado.fim);
                        return ant.inicio === ant.fim ? dataCurta(ant.inicio) : `${dataCurta(ant.inicio)} a ${dataCurta(ant.fim)}`;
                      })()}
                    </p>
                  </div>
                )}
              </div>

              <div className="relative mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniIndicador icon={Receipt} label="Vendas realizadas" valor={metricas.quantidadeVendas.toString()} />
                <MiniIndicador
                  icon={Wallet}
                  label="Ticket médio"
                  valor={formatarMoeda(metricas.quantidadeVendas > 0 ? metricas.totalFaturado / metricas.quantidadeVendas : 0)}
                />
                <MiniIndicador icon={CalendarDays} label="Média por dia" valor={formatarMoeda(mediaPorDia)} />
                <MiniIndicador
                  icon={Repeat}
                  label="Trocas no período"
                  valor={metricas.quantidadeTrocas.toString()}
                  subtitulo={
                    metricas.quantidadeTrocas > 0
                      ? `${metricas.totalTrocas >= 0 ? "+" : "−"}${formatarMoeda(Math.abs(metricas.totalTrocas))} de ajuste`
                      : undefined
                  }
                />
              </div>
            </div>

            {/* gráfico de vendas por dia */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
                <h3 className="text-sm font-semibold">Vendas por dia</h3>
                {melhorDia && (
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    <Trophy className="w-3.5 h-3.5 text-accent-dark" />
                    Melhor dia: <span className="font-medium text-foreground">{dataCurta(melhorDia.dia)}</span>
                    <span className="font-mono text-foreground">{formatarMoeda(melhorDia.total)}</span>
                  </p>
                )}
              </div>
              {vendasPorDia.length === 0 ? (
                <p className="text-sm text-muted">Nenhuma venda no período.</p>
              ) : (
                <div className="overflow-x-auto pt-6">
                  <div style={{ minWidth: vendasPorDia.length > 20 ? vendasPorDia.length * 28 : undefined }}>
                    <div className="relative h-40 flex items-end gap-1.5 border-b border-border/70">
                      {/* linha da média diária do período */}
                      <div
                        className="absolute inset-x-0 border-t border-dashed border-accent-dark/70 pointer-events-none"
                        style={{ bottom: `${Math.min(100, (mediaPorDia / maiorValorDia) * 100)}%` }}
                      >
                        <span className="absolute right-0 -top-4 text-[10px] text-accent-dark bg-surface/80 px-1 rounded">
                          média {formatarMoeda(mediaPorDia)}
                        </span>
                      </div>
                      {vendasPorDia.map(({ dia, total }) => {
                        const alturaPct = Math.max(4, (total / maiorValorDia) * 100);
                        const eMelhor = melhorDia?.dia === dia && vendasPorDia.length > 1;
                        return (
                          <div key={dia} className="flex-1 h-full flex items-end group relative">
                            <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition text-[11px] bg-primary-dark text-white px-2 py-1 rounded whitespace-nowrap pointer-events-none z-10">
                              {dataCurta(dia)} · {formatarMoeda(total)}
                            </div>
                            <div
                              className={`w-full rounded-t transition-all ${
                                eMelhor ? "bg-accent hover:bg-accent-dark" : "bg-info hover:bg-info-dark"
                              }`}
                              style={{ height: `${alturaPct}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-1.5 mt-1.5">
                      {vendasPorDia.map(({ dia }) => (
                        <span key={dia} className="flex-1 text-center text-[10px] text-muted font-mono">
                          {dataCurta(dia)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-surface border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-1">Por forma de pagamento</h3>
                <p className="text-[11px] text-muted mb-4">Vendas e ajuste de trocas já somados</p>
                <ul className="space-y-4">
                  {formasOrdenadas.itens.map(([forma, valor]) => {
                    const pct = formasOrdenadas.base > 0 ? (Math.max(valor, 0) / formasOrdenadas.base) * 100 : 0;
                    return (
                      <li key={forma}>
                        <div className="flex items-center justify-between text-sm gap-2">
                          <span className="flex items-center gap-2 text-foreground">
                            <span className={`w-2.5 h-2.5 rounded-full ${COR_FORMA[forma] ?? "bg-muted"}`} />
                            {LABEL_FORMA_PAGAMENTO[forma] ?? forma}
                          </span>
                          <span className="flex items-baseline gap-2">
                            <span className="text-[11px] text-muted font-mono">{pct.toFixed(0)}%</span>
                            <span className="font-mono font-medium">{formatarMoeda(valor)}</span>
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-background overflow-hidden">
                          <div
                            className={`h-full rounded-full ${COR_FORMA[forma] ?? "bg-muted"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                  {formasOrdenadas.itens.length === 0 && (
                    <p className="text-sm text-muted">Nenhuma venda no período.</p>
                  )}
                </ul>
              </div>

              <div className="bg-surface border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-4">Produtos mais vendidos</h3>
                <ul className="space-y-3.5">
                  {metricas.produtosMaisVendidos.map((p, idx) => {
                    const maior = metricas.produtosMaisVendidos[0]?.quantidadeVendida || 1;
                    return (
                      <li key={p.nome}>
                        <div className="flex items-center justify-between text-sm gap-2">
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-mono text-[11px] font-semibold ${
                                idx === 0 ? "bg-accent text-white" : "bg-info-light text-info-dark"
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <span className="truncate text-foreground">{p.nome}</span>
                          </span>
                          <span className="text-right whitespace-nowrap">
                            <span className="font-mono font-medium">{p.quantidadeVendida}x</span>
                            <span className="block text-[11px] text-muted font-mono">{formatarMoeda(p.totalVendido)}</span>
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-background overflow-hidden">
                          <div
                            className={`h-full rounded-full ${idx === 0 ? "bg-accent" : "bg-info"}`}
                            style={{ width: `${(p.quantidadeVendida / maior) * 100}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                  {metricas.produtosMaisVendidos.length === 0 && (
                    <p className="text-sm text-muted">Nenhuma venda no período.</p>
                  )}
                </ul>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                <Vault className="w-4 h-4 text-primary" />
                Conciliação de caixa
              </h3>
              <p className="text-[11px] text-muted mb-4">
                Compara o que deveria estar na gaveta com o que foi contado no fechamento
              </p>

              {historicoCaixas.length === 0 ? (
                <p className="text-sm text-muted">Nenhuma abertura de caixa no período.</p>
              ) : (
                <div className="space-y-3">
                  {historicoCaixas.map((caixa) => {
                    const conf = conferenciaCaixas.get(caixa.id);
                    const diferenca = conf?.diferencaEsperado ?? null;
                    const confere = diferenca !== null ? Math.abs(diferenca) < 0.01 : null;
                    const sobra = diferenca !== null && diferenca > 0;

                    return (
                      <div key={caixa.id} className="border border-border rounded-lg overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-background">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                            <span
                              className={`px-1.5 py-0.5 rounded font-medium ${
                                caixa.aberto
                                  ? "bg-primary-light text-primary-dark"
                                  : "bg-border text-foreground"
                              }`}
                            >
                              {caixa.aberto ? "Aberto" : "Fechado"}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              Aberto por {caixa.usuarioAberturaNome}, {formatarDataHora(caixa.dataAbertura)}
                            </span>
                            {!caixa.aberto && caixa.dataFechamento && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Fechado por {caixa.usuarioFechamentoNome}, {formatarDataHora(caixa.dataFechamento)}
                              </span>
                            )}
                            {caixa.dataReabertura && (
                              <span className="flex items-center gap-1 text-accent-dark">
                                <RotateCcw className="w-3 h-3" />
                                Reaberto por {caixa.usuarioReaberturaNome}, {formatarDataHora(caixa.dataReabertura)}
                              </span>
                            )}
                          </div>
                          {confere !== null && (
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                confere
                                  ? "bg-primary-light text-primary-dark"
                                  : sobra
                                    ? "bg-accent-light text-accent-dark"
                                    : "bg-danger-light text-danger"
                              }`}
                            >
                              {confere ? "Confere" : sobra ? "Sobra em caixa" : "Falta em caixa"}
                            </span>
                          )}
                        </div>

                        {caixa.valorFinal !== null && conf ? (
                          <div className="px-4 py-3">
                            <div className="space-y-1.5">
                              <LinhaConciliacao label="Saldo inicial" valor={caixa.valorInicial} />
                              <LinhaConciliacao
                                label="Vendas em dinheiro"
                                valor={conf.vendasDinheiro}
                                comSinal
                              />
                              {conf.trocasDinheiro !== 0 && (
                                <LinhaConciliacao
                                  label="Ajuste de trocas em dinheiro"
                                  valor={conf.trocasDinheiro}
                                  comSinal
                                />
                              )}
                              {conf.suprimentos !== 0 && (
                                <LinhaConciliacao label="Suprimento (reforço)" valor={conf.suprimentos} comSinal />
                              )}
                              {conf.saidasDinheiro !== 0 && (
                                <LinhaConciliacao
                                  label="Sangria / despesas em dinheiro"
                                  valor={-conf.saidasDinheiro}
                                  comSinal
                                />
                              )}
                            </div>
                            <div className="flex items-center justify-between pt-2 mt-2 border-t border-dashed border-border text-xs">
                              <span className="text-muted">Esperado na gaveta</span>
                              <span className="font-mono">{formatarMoeda(conf.saldoEsperado)}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted">Contado no fechamento</span>
                              <span className="font-mono">{formatarMoeda(caixa.valorFinal)}</span>
                            </div>
                            <div className="flex items-center justify-between pt-2 mt-2 border-t border-border">
                              <span className="text-sm font-medium">Diferença</span>
                              <span
                                className={`font-mono text-base font-semibold ${
                                  confere ? "text-primary-dark" : sobra ? "text-accent-dark" : "text-danger"
                                }`}
                              >
                                {diferenca !== null && diferenca > 0 ? "+" : ""}
                                {formatarMoeda(diferenca ?? 0)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="px-4 py-3 text-xs text-muted">
                            Caixa ainda aberto — a conferência aparece depois do fechamento.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-surface border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Repeat className="w-4 h-4 text-primary" />
                Trocas do período
              </h3>

              {trocasFiltradas.length === 0 ? (
                <p className="text-sm text-muted">Nenhuma troca no período.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {trocasFiltradas.map((troca) => (
                    <li key={troca.id} className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                        <span className="font-mono text-primary">Troca #{troca.id}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatarDataHora(troca.dataHora)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {troca.usuarioNome}
                        </span>
                        {troca.vendaOrigemId && <span>Ref. venda #{troca.vendaOrigemId}</span>}
                      </div>
                      <div className="flex items-center gap-4 font-mono text-sm">
                        <span title="Valor dos produtos devolvidos">
                          <span className="text-muted text-xs">Devolvido: </span>
                          {formatarMoeda(troca.valorDevolvido)}
                        </span>
                        <span title="Valor dos produtos novos levados">
                          <span className="text-muted text-xs">Novo: </span>
                          {formatarMoeda(troca.valorNovo)}
                        </span>
                        {troca.diferenca !== 0 && (
                          <span>
                            <span className="text-muted text-xs">
                              {troca.diferenca > 0 ? "Cliente pagou" : "Loja devolveu"}
                              {troca.formaPagamentoDiferenca
                                ? ` (${LABEL_FORMA_PAGAMENTO[troca.formaPagamentoDiferenca]})`
                                : ""}
                              :{" "}
                            </span>
                            <span className={troca.diferenca > 0 ? "text-primary-dark" : "text-danger"}>
                              {formatarMoeda(Math.abs(troca.diferenca))}
                            </span>
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

          </>
        )}
      </div>

      {confirmandoFechamento && (
        <ConfirmarFechamentoCaixaModal
          valor={Number(valorFinalCaixa.replace(",", ".")) || 0}
          confirmando={fechandoCaixa}
          erro={erroFechamento}
          onCancelar={() => setConfirmandoFechamento(false)}
          onConfirmar={fecharCaixa}
        />
      )}
    </div>
  );
}

function LinhaConciliacao({
  label,
  valor,
  comSinal,
}: {
  label: string;
  valor: number;
  comSinal?: boolean;
}) {
  const sinal = comSinal && valor > 0 ? "+" : "";
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted">{label}</span>
      <span className="font-mono">
        {sinal}
        {formatarMoeda(valor)}
      </span>
    </div>
  );
}

function MiniIndicador({
  icon: Icon,
  label,
  valor,
  subtitulo,
}: {
  icon: React.ElementType;
  label: string;
  valor: string;
  subtitulo?: string;
}) {
  return (
    <div className="rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur-sm px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[11px] text-white/70">
        <Icon className="w-3.5 h-3.5 text-accent" />
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold font-mono tracking-tight">{valor}</p>
      {subtitulo && <p className="text-[11px] text-white/60 mt-0.5">{subtitulo}</p>}
    </div>
  );
}
