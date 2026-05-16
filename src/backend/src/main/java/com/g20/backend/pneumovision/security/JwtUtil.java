package com.g20.backend.pneumovision.security;

import com.g20.backend.pneumovision.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Objects;

@Component
@RequiredArgsConstructor
public class JwtUtil {

    private final JwtProperties jwtProperties;

    private SecretKey secretKey() {
        String secret = jwtProperties.getSecret();
        if (secret.length() < 32) {
            secret = secret + "00000000000000000000000000000000".substring(0, 32 - secret.length());
        }
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(Long userId, String username, String role) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + jwtProperties.getExpirationMs());
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("username", username)
                .claim("role", role)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(secretKey())
                .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(secretKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public Long getUserId(String token) {
        return Long.parseLong(parseToken(token).getSubject());
    }

    public String getUsername(String token) {
        return (String) parseToken(token).get("username");
    }

    public String getRole(String token) {
        return (String) parseToken(token).get("role");
    }

    public Date getExpiration(String token) {
        return parseToken(token).getExpiration();
    }

    /**
     * @return token 剩余毫秒数；如果 token 已经过期，返回 <= 0
     */
    public long getRemainingMillis(String token) {
        Date expiration = getExpiration(token);
        if (expiration == null) {
            return 0;
        }
        long remaining = expiration.getTime() - System.currentTimeMillis();
        return remaining;
    }

    public boolean validateToken(String token) {
        try {
            parseToken(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
