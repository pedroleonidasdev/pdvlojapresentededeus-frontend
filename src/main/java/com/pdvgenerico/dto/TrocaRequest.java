package com.pdvgenerico.dto;

import com.pdvgenerico.model.FormaPagamento;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.List;

public record TrocaRequest(
        Long vendaOrigemId,

        @Size(max = 255, message = "Observação deve ter no máximo 255 caracteres")
        String observacao,

        /**
         * Só é obrigatória quando a diferença calculada (valorNovo - valorDevolvido)
         * for diferente de zero; a validação disso acontece no service, porque a
         * diferença só é conhecida depois de calcular os itens.
         */
        FormaPagamento formaPagamentoDiferenca,

        @NotEmpty(message = "Informe ao menos um item devolvido pelo cliente")
        @Valid
        List<ItemTrocaRequest> itensDevolvidos,

        @NotEmpty(message = "Informe ao menos um item novo levado pelo cliente")
        @Valid
        List<ItemTrocaRequest> itensNovos
) {
    public record ItemTrocaRequest(
            @NotNull Long produtoId,
            @NotNull @Positive(message = "Quantidade deve ser maior que zero") Integer quantidade
    ) {
    }
}
