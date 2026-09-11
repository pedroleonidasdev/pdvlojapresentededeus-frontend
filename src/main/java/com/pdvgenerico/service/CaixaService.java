package com.pdvgenerico.service;

import com.pdvgenerico.dto.CaixaRequest;
import com.pdvgenerico.exception.BusinessException;
import com.pdvgenerico.exception.ResourceNotFoundException;
import com.pdvgenerico.model.Caixa;
import com.pdvgenerico.model.Usuario;
import com.pdvgenerico.repository.CaixaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CaixaService {

    private final CaixaRepository caixaRepository;

    public Optional<Caixa> buscarCaixaAberto() {
        return caixaRepository.findByAbertoTrue();
    }

    public List<Caixa> listarPorPeriodo(LocalDateTime inicio, LocalDateTime fim) {
        return caixaRepository.findByDataAberturaBetweenOrderByDataAberturaDesc(inicio, fim);
    }

    @Transactional
    public Caixa abrir(CaixaRequest request, Usuario usuarioLogado) {
        if (caixaRepository.findByAbertoTrue().isPresent()) {
            throw new BusinessException("Já existe um caixa aberto. Feche o caixa atual antes de abrir um novo.");
        }

        Caixa caixa = Caixa.builder()
                .usuarioAbertura(usuarioLogado)
                .valorInicial(request.valorInicial())
                // grava sempre em UTC "cru", independente do fuso da máquina/servidor que roda o
                // backend — o frontend converte isso para o fuso de Brasília na hora de exibir.
                .dataAbertura(LocalDateTime.now(ZoneOffset.UTC))
                .aberto(true)
                .build();

        return caixaRepository.save(caixa);
    }

    @Transactional
    public Caixa fechar(CaixaRequest.FechamentoRequest request, Usuario usuarioLogado) {
        Caixa caixa = caixaRepository.findByAbertoTrue()
                .orElseThrow(() -> new ResourceNotFoundException("Não há caixa aberto no momento."));

        caixa.setUsuarioFechamento(usuarioLogado);
        caixa.setValorFinal(request.valorFinal());
        caixa.setDataFechamento(LocalDateTime.now(ZoneOffset.UTC));
        caixa.setAberto(false);

        return caixaRepository.save(caixa);
    }

    // Reabertura é restrita a ADMIN (ver @PreAuthorize no controller) e só é
    // permitida para o caixa fechado mais recente, pra não bagunçar o histórico
    // reabrindo um caixa antigo enquanto outros mais novos já foram fechados.
    @Transactional
    public Caixa reabrir(Long id, Usuario usuarioLogado) {
        if (caixaRepository.findByAbertoTrue().isPresent()) {
            throw new BusinessException("Já existe um caixa aberto. Feche o caixa atual antes de reabrir outro.");
        }

        Caixa caixa = caixaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Caixa não encontrado."));

        if (caixa.isAberto()) {
            throw new BusinessException("Este caixa já está aberto.");
        }

        Caixa ultimoFechado = caixaRepository.findFirstByAbertoFalseOrderByDataFechamentoDesc()
                .orElseThrow(() -> new ResourceNotFoundException("Não há caixa fechado para reabrir."));

        if (!ultimoFechado.getId().equals(caixa.getId())) {
            throw new BusinessException("Só é possível reabrir o caixa fechado mais recente.");
        }

        caixa.setAberto(true);
        caixa.setDataFechamento(null);
        caixa.setValorFinal(null);
        caixa.setUsuarioFechamento(null);
        caixa.setUsuarioReabertura(usuarioLogado);
        caixa.setDataReabertura(LocalDateTime.now(ZoneOffset.UTC));

        return caixaRepository.save(caixa);
    }
}
