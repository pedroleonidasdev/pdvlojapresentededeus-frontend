package com.pdvgenerico.dto;

public record LoginResponse(
        String token,
        String login,
        String nome,
        String perfil
) {
}
