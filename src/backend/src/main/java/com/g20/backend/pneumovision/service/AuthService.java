package com.g20.backend.pneumovision.service;

import com.g20.backend.pneumovision.common.enums.AuditActionEnum;
import com.g20.backend.pneumovision.common.exception.BusinessException;
import com.g20.backend.pneumovision.dto.auth.LoginRequest;
import com.g20.backend.pneumovision.dto.auth.LoginResponse;
import com.g20.backend.pneumovision.entity.User;
import com.g20.backend.pneumovision.repository.UserRepository;
import com.g20.backend.pneumovision.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuditService auditService;

    @Transactional
    public LoginResponse login(LoginRequest request, String ipAddress) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new BusinessException("用户名或密码错误"));
        if (!user.getEnabled()) {
            throw new BusinessException("账号已被禁用");
        }
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BusinessException("用户名或密码错误");
        }
        String token = jwtUtil.generateToken(user.getId(), user.getUsername(), user.getRole());
        auditService.log(AuditActionEnum.LOGIN, user.getId(), user.getUsername(), "登录成功", null, ipAddress);
        return LoginResponse.builder()
                .token(token)
                .userId(user.getId())
                .username(user.getUsername())
                .role(user.getRole())
                .build();
    }

    /**
     * 仅当系统中尚无任何用户时可用，用于首次部署创建管理员账号
     */
    @Transactional
    public LoginResponse initAdmin(String username, String password) {
        if (userRepository.count() > 0) {
            throw new BusinessException("系统已初始化，请使用登录接口");
        }
        User admin = User.builder()
                .username(username)
                .password(passwordEncoder.encode(password))
                .role("ADMIN")
                .enabled(true)
                .build();
        admin = userRepository.save(admin);
        auditService.log(AuditActionEnum.USER_CREATE, null, "system", "初始化管理员: " + username, null, null);
        String token = jwtUtil.generateToken(admin.getId(), admin.getUsername(), admin.getRole());
        return LoginResponse.builder()
                .token(token)
                .userId(admin.getId())
                .username(admin.getUsername())
                .role(admin.getRole())
                .build();
    }
}
