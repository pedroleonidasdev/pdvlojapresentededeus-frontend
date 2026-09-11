package com.pdvgenerico.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

public record EtiquetaImpressaoRequest(
        @NotEmpty(message = "Selecione ao menos uma etiqueta para imprimir")
        @Size(max = 100, message = "O lote aceita no máximo 100 etiquetas por requisição")
        @Valid
        List<Item> etiquetas
) {
    public record Item(
            @NotBlank String nome,
            @NotNull BigDecimal precoVenda,
            @NotBlank String codigoBarras
    ) {
    }
}
