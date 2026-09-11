package com.pdvgenerico.service;

import com.pdvgenerico.dto.TrocaRequest;
import com.pdvgenerico.exception.BusinessException;
import com.pdvgenerico.exception.ResourceNotFoundException;
import com.pdvgenerico.model.*;
import com.pdvgenerico.repository.ProdutoRepository;
import com.pdvgenerico.repository.TrocaRepository;
import com.pdvgenerico.repository.VendaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TrocaService {

    private final TrocaRepository trocaRepository;
    private final ProdutoRepository produtoRepository;
    private final VendaRepository vendaRepository;

    @Transactional
    public Troca registrarTroca(TrocaRequest request, Usuario usuarioLogado) {
        List<ItemTroca> itens = new ArrayList<>();

        Troca troca = Troca.builder()
                .usuario(usuarioLogado)
                .dataHora(LocalDateTime.now(ZoneOffset.UTC))
                .observacao(request.observacao())
                .build();

        if (request.vendaOrigemId() != null) {
            Venda vendaOrigem = vendaRepository.findById(request.vendaOrigemId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Venda de origem não encontrada: id " + request.vendaOrigemId()));
            troca.setVendaOrigem(vendaOrigem);
        }

        // Itens devolvidos pelo cliente: voltam para o estoque.
        BigDecimal valorDevolvido = BigDecimal.ZERO;
        for (TrocaRequest.ItemTrocaRequest itemReq : request.itensDevolvidos()) {
            Produto produto = produtoRepository.findById(itemReq.produtoId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Produto não encontrado: id " + itemReq.produtoId()));

            produto.setQuantidadeEstoque(produto.getQuantidadeEstoque() + itemReq.quantidade());
            produtoRepository.save(produto);

            BigDecimal subtotalItem = produto.getPrecoVenda().multiply(BigDecimal.valueOf(itemReq.quantidade()));
            valorDevolvido = valorDevolvido.add(subtotalItem);

            itens.add(ItemTroca.builder()
                    .troca(troca)
                    .produto(produto)
                    .tipo(TipoItemTroca.DEVOLVIDO)
                    .quantidade(itemReq.quantidade())
                    .precoUnitario(produto.getPrecoVenda())
                    .subtotal(subtotalItem)
                    .build());
        }

        // Itens novos levados pelo cliente: saem do estoque.
        BigDecimal valorNovo = BigDecimal.ZERO;
        for (TrocaRequest.ItemTrocaRequest itemReq : request.itensNovos()) {
            Produto produto = produtoRepository.findById(itemReq.produtoId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Produto não encontrado: id " + itemReq.produtoId()));

            if (produto.getQuantidadeEstoque() < itemReq.quantidade()) {
                throw new BusinessException("Estoque insuficiente para o produto: " + produto.getNome());
            }

            produto.setQuantidadeEstoque(produto.getQuantidadeEstoque() - itemReq.quantidade());
            produtoRepository.save(produto);

            BigDecimal subtotalItem = produto.getPrecoVenda().multiply(BigDecimal.valueOf(itemReq.quantidade()));
            valorNovo = valorNovo.add(subtotalItem);

            itens.add(ItemTroca.builder()
                    .troca(troca)
                    .produto(produto)
                    .tipo(TipoItemTroca.NOVO)
                    .quantidade(itemReq.quantidade())
                    .precoUnitario(produto.getPrecoVenda())
                    .subtotal(subtotalItem)
                    .build());
        }

        BigDecimal diferenca = valorNovo.subtract(valorDevolvido);

        // Se há diferença de valor (pra mais ou pra menos), a forma de acerto é obrigatória.
        if (diferenca.compareTo(BigDecimal.ZERO) != 0 && request.formaPagamentoDiferenca() == null) {
            throw new BusinessException(
                    "Informe a forma de pagamento/estorno da diferença de " + diferenca.abs() +
                            " entre o valor devolvido e o valor do(s) produto(s) novo(s).");
        }

        troca.setItens(itens);
        troca.setValorDevolvido(valorDevolvido);
        troca.setValorNovo(valorNovo);
        troca.setDiferenca(diferenca);
        troca.setFormaPagamentoDiferenca(
                diferenca.compareTo(BigDecimal.ZERO) != 0 ? request.formaPagamentoDiferenca() : null);

        return trocaRepository.save(troca);
    }

    public List<Troca> listarTodas() {
        return trocaRepository.findAllByOrderByDataHoraDesc();
    }

    public Troca buscarPorId(Long id) {
        return trocaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Troca não encontrada: id " + id));
    }

    public List<Troca> listarPorPeriodo(LocalDateTime inicio, LocalDateTime fim) {
        return trocaRepository.findByDataHoraBetweenOrderByDataHoraDesc(inicio, fim);
    }

    @Transactional
    public void excluir(Long id) {
        Troca troca = buscarPorId(id);
        estornarEstoque(troca);
        trocaRepository.delete(troca);
    }

    @Transactional
    public void excluirTodas() {
        List<Troca> trocas = trocaRepository.findAll();
        trocas.forEach(this::estornarEstoque);
        trocaRepository.deleteAll();
    }

    /**
     * Desfaz os efeitos de estoque de uma troca: os itens que haviam sido
     * devolvidos pelo cliente (e que entraram no estoque) voltam a sair, e os
     * itens novos que haviam saído do estoque voltam a entrar — ou seja, o
     * inverso exato do que aconteceu ao registrar a troca.
     */
    private void estornarEstoque(Troca troca) {
        for (ItemTroca item : troca.getItens()) {
            Produto produto = item.getProduto();
            if (item.getTipo() == TipoItemTroca.DEVOLVIDO) {
                produto.setQuantidadeEstoque(produto.getQuantidadeEstoque() - item.getQuantidade());
            } else {
                produto.setQuantidadeEstoque(produto.getQuantidadeEstoque() + item.getQuantidade());
            }
            produtoRepository.save(produto);
        }
    }
}
