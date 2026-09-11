package com.pdvgenerico.service;

import com.pdvgenerico.dto.LoginRequest;
import com.pdvgenerico.dto.LoginResponse;
import com.pdvgenerico.model.Usuario;
import com.pdvgenerico.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;

    public LoginResponse login(LoginRequest request) {
        var authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.login(), request.senha()));

        Usuario usuario = (Usuario) authentication.getPrincipal();
        String token = jwtUtil.generateToken(usuario);

        return new LoginResponse(token, usuario.getLogin(), usuario.getNome(), usuario.getPerfil().name());
    }
}
