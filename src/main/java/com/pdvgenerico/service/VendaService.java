package com.pdvgenerico.service;

import com.pdvgenerico.dto.EditarFormaPagamentoRequest;
import com.pdvgenerico.dto.VendaRequest;
import com.pdvgenerico.exception.BusinessException;
import com.pdvgenerico.exception.ResourceNotFoundException;
import com.pdvgenerico.model.*;
import com.pdvgenerico.repository.ProdutoRepository;
import com.pdvgenerico.repository.UsuarioRepository;
import com.pdvgenerico.repository.VendaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class VendaService {

    private final VendaRepository vendaRepository;
    private final ProdutoRepository produtoRepository;
    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    private static final BigDecimal CEM = BigDecimal.valueOf(100);

    @Transactional
    public Venda registrarVenda(VendaRequest request, Usuario usuarioLogado) {
        List<ItemVenda> itens = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;

        Venda venda = Venda.builder()
                .usuario(usuarioLogado)
                // grava sempre em UTC "cru", independente do fuso da máquina/servidor que roda o
                // backend — o frontend converte isso para o fuso de Brasília na hora de exibir.
                // Se usássemos LocalDateTime.now() puro, o valor mudaria de significado conforme
                // o fuso do host (ex: máquina local em Brasília vs. servidor em UTC no Render).
                .dataHora(LocalDateTime.now(ZoneOffset.UTC))
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

            BigDecimal subtotalItem = produto.getPrecoVenda().multiply(BigDecimal.valueOf(itemReq.quantidade()));
            subtotal = subtotal.add(subtotalItem);

            ItemVenda item = ItemVenda.builder()
                    .venda(venda)
                    .produto(produto)
                    .quantidade(itemReq.quantidade())
                    .precoUnitario(produto.getPrecoVenda())
                    .subtotal(subtotalItem)
                    .build();

            itens.add(item);
        }

        // Desconto: percentual e valor em dinheiro se somam — dá pra usar os dois
        // juntos (ex: 10% de desconto + tirar mais R$ 2 pra fechar redondo).
        BigDecimal percentualDesconto = request.percentualDesconto() != null
                ? request.percentualDesconto()
                : BigDecimal.ZERO;
        BigDecimal valorDescontoInformado = request.valorDescontoInformado() != null
                ? request.valorDescontoInformado()
                : BigDecimal.ZERO;

        BigDecimal valorDescontoPercentual = subtotal
                .multiply(percentualDesconto)
                .divide(CEM, 2, RoundingMode.HALF_UP);

        // nunca deixa o total ficar negativo, mesmo somando os dois descontos
        BigDecimal valorDesconto = valorDescontoPercentual.add(valorDescontoInformado).min(subtotal);

        BigDecimal total = subtotal.subtract(valorDesconto);

        venda.setItens(itens);
        venda.setSubtotal(subtotal);
        venda.setPercentualDesconto(percentualDesconto);
        venda.setValorDesconto(valorDesconto);
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

    /**
     * Corrige a forma de pagamento de uma venda já registrada — cenário típico:
     * o operador de caixa selecionou a forma errada na hora da venda.
     * ADMIN pode corrigir diretamente. Qualquer outro perfil (CAIXA) só consegue
     * se informar login e senha de um usuário ADMIN ativo — a correção fica
     * "assinada" por esse administrador.
     */
    @Transactional
    public Venda editarFormaPagamento(Long id, EditarFormaPagamentoRequest request, Usuario usuarioLogado) {
        Venda venda = buscarPorId(id);

        if (usuarioLogado.getPerfil() != Perfil.ADMIN) {
            autorizarComoAdmin(request.usuarioAutorizacaoLogin(), request.senhaAutorizacao());
        }

        venda.setFormaPagamento(request.formaPagamento());
        return vendaRepository.save(venda);
    }

    private void autorizarComoAdmin(String login, String senha) {
        if (login == null || login.isBlank() || senha == null || senha.isBlank()) {
            throw new BusinessException("Login e senha de um administrador são obrigatórios para esta edição");
        }

        Usuario admin = usuarioRepository.findByLogin(login)
                .orElseThrow(() -> new BusinessException("Autorização inválida: usuário não encontrado"));

        if (admin.getPerfil() != Perfil.ADMIN) {
            throw new BusinessException("Autorização inválida: usuário informado não é administrador");
        }
        if (!admin.isAtivo()) {
            throw new BusinessException("Autorização inválida: usuário administrador está inativo");
        }
        if (!passwordEncoder.matches(senha, admin.getSenha())) {
            throw new BusinessException("Autorização inválida: senha incorreta");
        }
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