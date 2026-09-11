package com.pdvgenerico.dto;

import com.pdvgenerico.model.FormaPagamento;
import com.pdvgenerico.model.TipoDespesa;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record DespesaRequest(
        @NotNull(message = "Informe o tipo: despesa, sangria ou suprimento")
        TipoDespesa tipo,

        @Size(max = 60, message = "Categoria deve ter no máximo 60 caracteres")
        String categoria,

        @NotBlank(message = "Descrição é obrigatória")
        @Size(max = 255, message = "Descrição deve ter no máximo 255 caracteres")
        String descricao,

        @NotNull @Positive(message = "Valor deve ser maior que zero")
        BigDecimal valor,

        // Obrigatória apenas para tipo=DESPESA. Para SANGRIA/SUPRIMENTO o backend
        // sempre força DINHEIRO, independente do que vier aqui — dinheiro é a
        // única forma que sai/entra fisicamente na gaveta.
        FormaPagamento formaPagamento
) {
}
