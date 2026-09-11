package com.pdvgenerico.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pdvgenerico.dto.EtiquetaImpressaoRequest;
import com.pdvgenerico.exception.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

/**
 * Aciona o agente local goldensky-etiquetas.py, que roda no mesmo computador que
 * tem a impressora térmica Goldensky-80 conectada via USB e a fila CUPS configurada.
 * Se o backend estiver hospedado em nuvem (Render, etc.) e não neste computador,
 * esse serviço não vai conseguir imprimir — a impressora é um recurso local.
 */
@Service
public class ImpressoraEtiquetaService {

    private static final Logger log = LoggerFactory.getLogger(ImpressoraEtiquetaService.class);

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${app.impressora.python-bin:python3}")
    private String pythonBin;

    @Value("${app.impressora.script-path:/usr/local/bin/goldensky-etiquetas.py}")
    private String scriptPath;

    @Value("${app.impressora.timeout-segundos:30}")
    private long timeoutSegundos;

    public void imprimir(EtiquetaImpressaoRequest request) {
        if (!Files.exists(Path.of(scriptPath))) {
            throw new BusinessException(
                    "Agente de impressão não encontrado neste computador (" + scriptPath + "). " +
                            "Instale com scripts/install-goldensky-etiquetas.sh no computador conectado à impressora."
            );
        }

        String payload;
        try {
            payload = objectMapper.writeValueAsString(request);
        } catch (IOException e) {
            throw new BusinessException("Não foi possível preparar os dados das etiquetas");
        }

        try {
            // usa ProcessBuilder com argumentos fixos (sem shell intermediário) para
            // que os dados do produto (nome, código de barras) nunca passem por um
            // shell — reduz a superfície de risco de injeção de comandos.
            ProcessBuilder processBuilder = new ProcessBuilder(pythonBin, scriptPath);
            processBuilder.redirectErrorStream(false);
            Process process = processBuilder.start();

            try (var writer = process.getOutputStream()) {
                writer.write(payload.getBytes(StandardCharsets.UTF_8));
            }

            boolean terminou = process.waitFor(timeoutSegundos, TimeUnit.SECONDS);
            if (!terminou) {
                process.destroyForcibly();
                throw new BusinessException("A impressora não respondeu a tempo. Verifique a fila Goldensky-80.");
            }

            String stderr = new String(process.getErrorStream().readAllBytes(), StandardCharsets.UTF_8).trim();

            if (process.exitValue() != 0) {
                log.warn("goldensky-etiquetas.py retornou código {}: {}", process.exitValue(), stderr);
                throw new BusinessException(
                        stderr.isBlank() ? "Falha ao enviar as etiquetas para a impressora" : stderr
                );
            }
        } catch (IOException e) {
            log.error("Erro ao executar o agente de impressão", e);
            throw new BusinessException("Não foi possível acionar o agente de impressão neste computador");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException("Impressão interrompida");
        }
    }
}
