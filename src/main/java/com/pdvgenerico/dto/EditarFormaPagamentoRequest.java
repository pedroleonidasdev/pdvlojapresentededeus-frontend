package com.pdvgenerico.dto;

import com.pdvgenerico.model.FormaPagamento;
import jakarta.validation.constraints.NotNull;

public record EditarFormaPagamentoRequest(
        @NotNull FormaPagamento formaPagamento,

        // obrigatórios apenas quando quem está editando NÃO é ADMIN — nesse caso,
        // um administrador precisa "assinar" a correção com o próprio login e senha
        String usuarioAutorizacaoLogin,
        String senhaAutorizacao
) {
}
