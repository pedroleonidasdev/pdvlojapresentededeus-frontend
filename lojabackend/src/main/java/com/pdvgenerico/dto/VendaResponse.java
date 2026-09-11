package com.pdvgenerico.dto;

import com.pdvgenerico.model.Venda;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record VendaResponse(
        Long id,
        String usuarioNome,
        LocalDateTime dataHora,
        String formaPagamento,
        BigDecimal total,
        List<ItemVendaResponse> itens
) {
    public static VendaResponse fromEntity(Venda venda) {
        return new VendaResponse(
                venda.getId(),
                venda.getUsuario().getNome(),
                venda.getDataHora(),
                venda.getFormaPagamento().name(),
                venda.getTotal(),
                venda.getItens().stream().map(ItemVendaResponse::fromEntity).toList()
        );
    }
}