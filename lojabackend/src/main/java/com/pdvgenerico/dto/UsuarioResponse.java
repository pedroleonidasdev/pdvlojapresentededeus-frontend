package com.pdvgenerico.dto;

import com.pdvgenerico.model.Usuario;

public record UsuarioResponse(
        Long id,
        String login,
        String nome,
        String perfil,
        boolean ativo
) {
    public static UsuarioResponse fromEntity(Usuario usuario) {
        return new UsuarioResponse(
                usuario.getId(),
                usuario.getLogin(),
                usuario.getNome(),
                usuario.getPerfil().name(),
                usuario.isAtivo()
        );
    }
}
