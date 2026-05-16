package com.g20.backend.pneumovision.security;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 当前登录用户信息，存入 SecurityContext
 */
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class LoginUser {

    private Long id;
    private String username;
    private String role;

    public boolean isAdmin() {
        return "ADMIN".equals(role);
    }
}
