package com.pdvgenerico.service;

import com.pdvgenerico.dto.VendaRequest;
import com.pdvgenerico.exception.BusinessException;
import com.pdvgenerico.exception.ResourceNotFoundException;
import com.pdvgenerico.model.*;
import com.pdvgenerico.repository.ProdutoRepository;
import com.pdvgenerico.repository.VendaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class VendaService {

    private final VendaRepository vendaRepository;
    private final ProdutoRepository produtoRepository;

    @Transactional
    public Venda registrarVenda(VendaRequest request, Usuario usuarioLogado) {
        List<ItemVenda> itens = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;

        Venda venda = Venda.builder()
                .usuario(usuarioLogado)
                .dataHora(LocalDateTime.now())
                .formaPagamento(request.formaPagamento())
                .total(BigDecimal.ZERO)
                .build();

        for (VendaRequest.ItemVendaRequest itemReq : request.itens()) {
            Produto produto = produtoRepository.findById(itemReq.produtoId())
                    .orElseThrow(() -> new ResourceNotFoundException("Produto não encontrado: id " + itemReq.produtoId()));

            if (produto.getQuantidadeEstoque() < itemReq.quantidade()) {
                throw new BusinessException("Estoque insuficiente para o produto: " + produto.getNome());
            }

            produto.setQuantidadeEstoque(produto.getQuantidadeEstoque() - itemReq.quantidade());
            produtoRepository.save(produto);

            BigDecimal subtotal = produto.getPrecoVenda().multiply(BigDecimal.valueOf(itemReq.quantidade()));
            total = total.add(subtotal);

            ItemVenda item = ItemVenda.builder()
                    .venda(venda)
                    .produto(produto)
                    .quantidade(itemReq.quantidade())
                    .precoUnitario(produto.getPrecoVenda())
                    .subtotal(subtotal)
                    .build();

            itens.add(item);
        }

        venda.setItens(itens);
        venda.setTotal(total);

        return vendaRepository.save(venda);
    }

    public List<Venda> listarTodas() {
        return vendaRepository.findAllByOrderByDataHoraDesc();
    }

    public Venda buscarPorId(Long id) {
        return vendaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Venda não encontrada: id " + id));
    }

    public List<Venda> listarPorPeriodo(LocalDateTime inicio, LocalDateTime fim) {
        return vendaRepository.findByDataHoraBetweenOrderByDataHoraDesc(inicio, fim);
    }

    @Transactional
    public void excluir(Long id) {
        Venda venda = buscarPorId(id);
        devolverEstoque(venda);
        vendaRepository.delete(venda);
    }

    @Transactional
    public void excluirTodas() {
        List<Venda> vendas = vendaRepository.findAll();
        vendas.forEach(this::devolverEstoque);
        vendaRepository.deleteAll();
    }

    private void devolverEstoque(Venda venda) {
        for (ItemVenda item : venda.getItens()) {
            Produto produto = item.getProduto();
            produto.setQuantidadeEstoque(produto.getQuantidadeEstoque() + item.getQuantidade());
            produtoRepository.save(produto);
        }
    }
}