package com.pdvgenerico.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

public record CaixaRequest(
        @NotNull @PositiveOrZero BigDecimal valorInicial
) {
    public record FechamentoRequest(
            @NotNull @PositiveOrZero BigDecimal valorFinal
    ) {
    }
}
