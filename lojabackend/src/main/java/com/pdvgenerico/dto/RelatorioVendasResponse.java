package com.pdvgenerico.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record RelatorioVendasResponse(
        BigDecimal totalFaturado,
        long quantidadeVendas,
        Map<String, BigDecimal> totalPorFormaPagamento,
        List<ProdutoMaisVendido> produtosMaisVendidos
) {
    public record ProdutoMaisVendido(
            String nome,
            long quantidadeVendida,
            BigDecimal totalVendido
    ) {
    }
}
