package com.pdvgenerico.controller;

import com.pdvgenerico.dto.CaixaRequest;
import com.pdvgenerico.dto.CaixaResponse;
import com.pdvgenerico.model.Caixa;
import com.pdvgenerico.model.Usuario;
import com.pdvgenerico.service.CaixaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/caixa")
@RequiredArgsConstructor
public class CaixaController {

    private final CaixaService caixaService;

    @GetMapping("/atual")
    @PreAuthorize("hasAnyRole('ADMIN', 'CAIXA')")
    public ResponseEntity<CaixaResponse> caixaAtual() {
        return caixaService.buscarCaixaAberto()
                .map(caixa -> ResponseEntity.ok(CaixaResponse.fromEntity(caixa)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<CaixaResponse> listarPorPeriodo(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime inicio,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fim) {
        List<Caixa> caixas = caixaService.listarPorPeriodo(inicio, fim);
        return caixas.stream().map(CaixaResponse::fromEntity).toList();
    }

    @PostMapping("/abrir")
    @PreAuthorize("hasAnyRole('ADMIN', 'CAIXA')")
    public ResponseEntity<CaixaResponse> abrir(@Valid @RequestBody CaixaRequest request,
                                                @AuthenticationPrincipal Usuario usuarioLogado) {
        return ResponseEntity.ok(CaixaResponse.fromEntity(caixaService.abrir(request, usuarioLogado)));
    }

    // Fechamento pode ser feito por ADMIN ou CAIXA. O operador de caixa só informa
    // o valor contado fisicamente (dinheiro em caixa) — o sistema não expõe o
    // faturamento do dia pra ele nessa tela; só o ADMIN vê esse comparativo depois,
    // em Relatórios.
    @PostMapping("/fechar")
    @PreAuthorize("hasAnyRole('ADMIN', 'CAIXA')")
    public ResponseEntity<CaixaResponse> fechar(@Valid @RequestBody CaixaRequest.FechamentoRequest request,
                                                 @AuthenticationPrincipal Usuario usuarioLogado) {
        return ResponseEntity.ok(CaixaResponse.fromEntity(caixaService.fechar(request, usuarioLogado)));
    }

    // Só ADMIN reabre caixa, e só o fechado mais recente (ver CaixaService.reabrir).
    // Uso típico: caixa fechado por engano, ou faltou lançar uma venda antes de fechar.
    @PostMapping("/{id}/reabrir")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<CaixaResponse> reabrir(@PathVariable Long id,
                                                  @AuthenticationPrincipal Usuario usuarioLogado) {
        return ResponseEntity.ok(CaixaResponse.fromEntity(caixaService.reabrir(id, usuarioLogado)));
    }
}
