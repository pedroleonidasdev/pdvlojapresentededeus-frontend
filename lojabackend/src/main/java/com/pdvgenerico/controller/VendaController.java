package com.pdvgenerico.controller;

import com.pdvgenerico.dto.VendaRequest;
import com.pdvgenerico.dto.VendaResponse;
import com.pdvgenerico.model.Usuario;
import com.pdvgenerico.model.Venda;
import com.pdvgenerico.service.VendaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/vendas")
@RequiredArgsConstructor
public class VendaController {

    private final VendaService vendaService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'CAIXA')")
    public ResponseEntity<VendaResponse> registrar(@Valid @RequestBody VendaRequest request,
                                                   @AuthenticationPrincipal Usuario usuarioLogado) {
        return ResponseEntity.ok(VendaResponse.fromEntity(vendaService.registrarVenda(request, usuarioLogado)));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'CAIXA')")
    public List<VendaResponse> listar(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime inicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fim) {
        List<Venda> vendas = (inicio != null && fim != null)
                ? vendaService.listarPorPeriodo(inicio, fim)
                : vendaService.listarTodas();
        return vendas.stream().map(VendaResponse::fromEntity).toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CAIXA')")
    public VendaResponse buscarPorId(@PathVariable Long id) {
        return VendaResponse.fromEntity(vendaService.buscarPorId(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> excluir(@PathVariable Long id) {
        vendaService.excluir(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> excluirTodas() {
        vendaService.excluirTodas();
        return ResponseEntity.noContent().build();
    }
}