package com.pdvgenerico.dto;

import com.pdvgenerico.model.FormaPagamento;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record VendaRequest(
        @NotNull FormaPagamento formaPagamento,
        @NotEmpty @Valid List<ItemVendaRequest> itens
) {
    public record ItemVendaRequest(
            @NotNull Long produtoId,
            @NotNull Integer quantidade
    ) {
    }
}
