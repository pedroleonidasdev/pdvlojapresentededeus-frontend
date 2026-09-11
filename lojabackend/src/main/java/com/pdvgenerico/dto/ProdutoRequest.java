package com.pdvgenerico.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

public record ProdutoRequest(
        @NotBlank String nome,
        String codigoBarras,
        Long categoriaId,
        @NotNull @PositiveOrZero BigDecimal precoVenda,
        BigDecimal precoCusto,
        @NotNull @PositiveOrZero Integer quantidadeEstoque,
        Integer estoqueMinimo
) {
}
