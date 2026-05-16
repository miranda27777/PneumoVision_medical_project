package com.g20.backend.pneumovision.controller.auth;

import com.g20.backend.pneumovision.common.exception.BusinessException;
import com.g20.backend.pneumovision.common.enums.AuditActionEnum;
import com.g20.backend.pneumovision.common.result.ApiResponse;
import com.g20.backend.pneumovision.dto.auth.InitAdminRequest;
import com.g20.backend.pneumovision.dto.auth.LoginRequest;
import com.g20.backend.pneumovision.dto.auth.LoginResponse;
import com.g20.backend.pneumovision.security.LoginUser;
import com.g20.backend.pneumovision.security.JwtUtil;
import com.g20.backend.pneumovision.security.TokenBlacklistService;
import com.g20.backend.pneumovision.service.AuthService;
import com.g20.backend.pneumovision.service.AuditService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.util.StringUtils;

/**
 * 认证相关接口：登录 / 初始化管理员 / 退出（审计记录）。
 */
@RestController
@RequestMapping("/api/auth")
@Validated
public class AuthController {

    private final AuthService authService;
    private final AuditService auditService;
    private final JwtUtil jwtUtil;
    private final TokenBlacklistService tokenBlacklistService;

    public AuthController(AuthService authService, AuditService auditService, JwtUtil jwtUtil, TokenBlacklistService tokenBlacklistService) {
        this.authService = authService;
        this.auditService = auditService;
        this.jwtUtil = jwtUtil;
        this.tokenBlacklistService = tokenBlacklistService;
    }

    /**
     * 登录：返回 JWT token 与用户信息
     */
    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpServletRequest
    ) {
        String ipAddress = httpServletRequest.getRemoteAddr();
        return ApiResponse.success(authService.login(request, ipAddress));
    }

    /**
     * 初始化管理员：仅当系统还没有用户时可用
     */
    @PostMapping("/init-admin")
    public ApiResponse<LoginResponse> initAdmin(
            @Valid @RequestBody InitAdminRequest request
    ) {
        return ApiResponse.success(authService.initAdmin(request.getUsername(), request.getPassword()));
    }

    /**
     * 退出：当前 JWT 无黑名单机制，这里记录审计日志。
     */
    @PostMapping("/logout")
    public ApiResponse<Void> logout(HttpServletRequest httpServletRequest) {
        LoginUser currentUser = getCurrentLoginUser();
        String ipAddress = httpServletRequest.getRemoteAddr();

        // 退出即刻失效：将当前 token 写入 Redis 黑名单（TTL=剩余有效期）
        String authHeader = httpServletRequest.getHeader("Authorization");
        if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            long ttlMillis = jwtUtil.getRemainingMillis(token);
            tokenBlacklistService.blacklist(token, ttlMillis);
        }

        auditService.log(
                AuditActionEnum.LOGOUT,
                currentUser.getId(),
                currentUser.getUsername(),
                "user:" + currentUser.getId(),
                "退出登录",
                ipAddress
        );
        return ApiResponse.success();
    }

    private LoginUser getCurrentLoginUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof LoginUser loginUser)) {
            throw new BusinessException("未登录或登录状态已失效");
        }
        return loginUser;
    }
}

