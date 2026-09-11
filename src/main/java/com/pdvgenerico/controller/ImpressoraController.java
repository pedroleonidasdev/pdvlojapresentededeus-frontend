package com.pdvgenerico.controller;

import com.pdvgenerico.dto.EtiquetaImpressaoRequest;
import com.pdvgenerico.service.ImpressoraEtiquetaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/impressora")
@RequiredArgsConstructor
public class ImpressoraController {

    private final ImpressoraEtiquetaService impressoraEtiquetaService;

    @PostMapping("/etiquetas")
    @PreAuthorize("hasAnyRole('ADMIN', 'CAIXA')")
    public ResponseEntity<Map<String, String>> imprimirEtiquetas(@Valid @RequestBody EtiquetaImpressaoRequest request) {
        impressoraEtiquetaService.imprimir(request);
        return ResponseEntity.ok(Map.of("mensagem", "Etiquetas enviadas para a Goldensky."));
    }
}
