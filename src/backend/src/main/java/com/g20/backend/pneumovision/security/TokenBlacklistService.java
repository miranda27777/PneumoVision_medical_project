package com.g20.backend.pneumovision.security;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.stereotype.Service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;

/**
 * JWT 黑名单（Redis 实现）
 *
 * - 将 token 做 SHA-256 哈希后作为 key 的一部分，避免明文存 token
 * - 设置 TTL = token 剩余有效期，使得记录自动过期
 */
@Service
public class TokenBlacklistService {

    private static final Logger log = LoggerFactory.getLogger(TokenBlacklistService.class);
    private static final String KEY_PREFIX = "jwt:blacklist:";

    private final StringRedisTemplate redisTemplate;

    public TokenBlacklistService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void blacklist(String token, long ttlMillis) {
        if (ttlMillis <= 0) {
            // token 已经过期或即将过期：无需黑名单
            return;
        }
        try {
            String key = KEY_PREFIX + sha256(token);
            redisTemplate.opsForValue().set(key, "1", Duration.ofMillis(ttlMillis));
        } catch (RedisConnectionFailureException e) {
            // 开发环境下 Redis 可能未启动：避免拦截器抛异常导致接口 500
            log.warn("Redis unavailable, skip blacklisting. {}", e.getMessage());
        }
    }

    public boolean isBlacklisted(String token) {
        try {
            String key = KEY_PREFIX + sha256(token);
            Boolean exists = redisTemplate.hasKey(key);
            return Boolean.TRUE.equals(exists);
        } catch (RedisConnectionFailureException e) {
            // 开发环境下 Redis 未连接：放行请求（相当于黑名单失效）
            // 生产环境建议改为“拒绝请求/记录告警”以保持安全性。
            log.warn("Redis unavailable, token blacklist check skipped. {}", e.getMessage());
            return false;
        }
    }

    private String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not supported", e);
        }
    }
}

