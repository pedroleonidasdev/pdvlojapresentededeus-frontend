package com.pdvgenerico.service;

import com.pdvgenerico.dto.RelatorioVendasResponse;
import com.pdvgenerico.model.ItemVenda;
import com.pdvgenerico.model.Venda;
import com.pdvgenerico.repository.VendaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RelatorioService {

    private final VendaRepository vendaRepository;

    public RelatorioVendasResponse gerarRelatorioPeriodo(LocalDateTime inicio, LocalDateTime fim) {
        List<Venda> vendas = vendaRepository.findByDataHoraBetweenOrderByDataHoraDesc(inicio, fim);

        BigDecimal totalFaturado = vendas.stream()
                .map(Venda::getTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, BigDecimal> totalPorFormaPagamento = vendas.stream()
                .collect(Collectors.groupingBy(
                        v -> v.getFormaPagamento().name(),
                        Collectors.reducing(BigDecimal.ZERO, Venda::getTotal, BigDecimal::add)
                ));

        List<ItemVenda> todosItens = vendas.stream()
                .flatMap(v -> v.getItens().stream())
                .toList();

        Map<String, List<ItemVenda>> itensPorProduto = todosItens.stream()
                .collect(Collectors.groupingBy(i -> i.getProduto().getNome()));

        List<RelatorioVendasResponse.ProdutoMaisVendido> produtosMaisVendidos = itensPorProduto.entrySet().stream()
                .map(entry -> {
                    long qtd = entry.getValue().stream().mapToLong(ItemVenda::getQuantidade).sum();
                    BigDecimal totalVendido = entry.getValue().stream()
                            .map(ItemVenda::getSubtotal)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    return new RelatorioVendasResponse.ProdutoMaisVendido(entry.getKey(), qtd, totalVendido);
                })
                .sorted(Comparator.comparingLong(RelatorioVendasResponse.ProdutoMaisVendido::quantidadeVendida).reversed())
                .limit(10)
                .toList();

        return new RelatorioVendasResponse(totalFaturado, vendas.size(), totalPorFormaPagamento, produtosMaisVendidos);
    }
}
