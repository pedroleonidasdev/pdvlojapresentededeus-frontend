package com.pdvgenerico.dto;

import com.pdvgenerico.model.Perfil;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UsuarioRequest(
        @NotBlank String login,
        String senha,
        @NotBlank String nome,
        @NotNull Perfil perfil,
        Boolean ativo
) {
}
