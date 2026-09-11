package com.pdvgenerico.config;

import com.pdvgenerico.model.Perfil;
import com.pdvgenerico.model.Usuario;
import com.pdvgenerico.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        if (usuarioRepository.count() == 0) {
            Usuario admin = Usuario.builder()
                    .login("admin")
                    .senha(passwordEncoder.encode("admin123"))
                    .nome("Administrador")
                    .perfil(Perfil.ADMIN)
                    .ativo(true)
                    .build();

            Usuario caixa = Usuario.builder()
                    .login("caixa")
                    .senha(passwordEncoder.encode("caixa123"))
                    .nome("Operador de Caixa")
                    .perfil(Perfil.CAIXA)
                    .ativo(true)
                    .build();

            usuarioRepository.save(admin);
            usuarioRepository.save(caixa);

            System.out.println("Usuários iniciais criados: admin/admin123 (ADMIN) e caixa/caixa123 (CAIXA)");
        }
    }
}
