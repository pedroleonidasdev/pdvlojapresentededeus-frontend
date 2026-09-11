package com.pdvgenerico.service;

import com.pdvgenerico.dto.DespesaRequest;
import com.pdvgenerico.exception.BusinessException;
import com.pdvgenerico.exception.ResourceNotFoundException;
import com.pdvgenerico.model.*;
import com.pdvgenerico.repository.DespesaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DespesaService {

    private final DespesaRepository despesaRepository;
    private final CaixaService caixaService;

    public List<Despesa> listarPorPeriodo(LocalDateTime inicio, LocalDateTime fim) {
        return despesaRepository.findByDataHoraBetweenOrderByDataHoraDesc(inicio, fim);
    }

    public List<Despesa> listarTodas() {
        return despesaRepository.findAllByOrderByDataHoraDesc();
    }

    @Transactional
    public Despesa registrar(DespesaRequest request, Usuario usuarioLogado) {
        // SANGRIA e SUPRIMENTO são sempre movimento físico de dinheiro na gaveta,
        // então só fazem sentido com um caixa aberto no momento.
        boolean movimentoDeCaixa = request.tipo() != TipoDespesa.DESPESA;

        Optional<Caixa> caixaAberto = caixaService.buscarCaixaAberto();

        if (movimentoDeCaixa && caixaAberto.isEmpty()) {
            throw new BusinessException(
                    "Não há caixa aberto no momento. Sangria e suprimento só podem ser lançados com o caixa aberto.");
        }

        // força DINHEIRO para sangria/suprimento, ignorando o que vier no request —
        // essas duas operações são sempre físicas, na gaveta.
        FormaPagamento formaPagamento = movimentoDeCaixa ? FormaPagamento.DINHEIRO : request.formaPagamento();

        if (formaPagamento == null) {
            throw new BusinessException("Informe a forma de pagamento da despesa.");
        }

        if (request.tipo() == TipoDespesa.DESPESA && (request.categoria() == null || request.categoria().isBlank())) {
            throw new BusinessException("Informe a categoria da despesa (ex: Aluguel, Fornecedor, Energia).");
        }

        Despesa despesa = Despesa.builder()
                .tipo(request.tipo())
                .categoria(request.categoria())
                .descricao(request.descricao())
                .valor(request.valor())
                .formaPagamento(formaPagamento)
                .dataHora(LocalDateTime.now(ZoneOffset.UTC))
                .usuario(usuarioLogado)
                // só vincula ao caixa quando o dinheiro realmente sai/entra da gaveta —
                // isso é o que a conferência de caixa em Relatórios usa depois
                .caixa(formaPagamento == FormaPagamento.DINHEIRO ? caixaAberto.orElse(null) : null)
                .build();

        return despesaRepository.save(despesa);
    }

    @Transactional
    public void excluir(Long id) {
        if (!despesaRepository.existsById(id)) {
            throw new ResourceNotFoundException("Despesa não encontrada.");
        }
        despesaRepository.deleteById(id);
    }
}
