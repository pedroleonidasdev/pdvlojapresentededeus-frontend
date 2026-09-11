package com.pdvgenerico.dto;

import com.pdvgenerico.model.ItemTroca;
import com.pdvgenerico.model.TipoItemTroca;

import java.math.BigDecimal;

public record ItemTrocaResponse(
        Long id,
        Long produtoId,
        String produtoNome,
        TipoItemTroca tipo,
        Integer quantidade,
        BigDecimal precoUnitario,
        BigDecimal subtotal
) {
    public static ItemTrocaResponse fromEntity(ItemTroca item) {
        return new ItemTrocaResponse(
                item.getId(),
                item.getProduto().getId(),
                item.getProduto().getNome(),
                item.getTipo(),
                item.getQuantidade(),
                item.getPrecoUnitario(),
                item.getSubtotal()
        );
    }
}
