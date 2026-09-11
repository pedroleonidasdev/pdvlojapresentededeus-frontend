package com.pdvgenerico.controller;

import com.pdvgenerico.dto.TrocaRequest;
import com.pdvgenerico.dto.TrocaResponse;
import com.pdvgenerico.model.Troca;
import com.pdvgenerico.model.Usuario;
import com.pdvgenerico.service.TrocaService;
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
@RequestMapping("/api/trocas")
@RequiredArgsConstructor
public class TrocaController {

    private final TrocaService trocaService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'CAIXA')")
    public ResponseEntity<TrocaResponse> registrar(@Valid @RequestBody TrocaRequest request,
                                                    @AuthenticationPrincipal Usuario usuarioLogado) {
        return ResponseEntity.ok(TrocaResponse.fromEntity(trocaService.registrarTroca(request, usuarioLogado)));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'CAIXA')")
    public List<TrocaResponse> listar(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime inicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fim) {
        List<Troca> trocas = (inicio != null && fim != null)
                ? trocaService.listarPorPeriodo(inicio, fim)
                : trocaService.listarTodas();
        return trocas.stream().map(TrocaResponse::fromEntity).toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CAIXA')")
    public TrocaResponse buscarPorId(@PathVariable Long id) {
        return TrocaResponse.fromEntity(trocaService.buscarPorId(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> excluir(@PathVariable Long id) {
        trocaService.excluir(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> excluirTodas() {
        trocaService.excluirTodas();
        return ResponseEntity.noContent().build();
    }
}
