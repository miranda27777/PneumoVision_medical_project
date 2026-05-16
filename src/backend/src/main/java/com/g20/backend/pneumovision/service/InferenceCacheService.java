package com.g20.backend.pneumovision.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@RequiredArgsConstructor
public class InferenceCacheService {

    private static final Logger log = LoggerFactory.getLogger(InferenceCacheService.class);
    private static final String KEY_PREFIX = "infer:predict:";
    private static final Duration DEFAULT_TTL = Duration.ofHours(24);

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public <T> T get(String key, Class<T> clazz) {
        try {
            String json = redisTemplate.opsForValue().get(KEY_PREFIX + key);
            if (json == null || json.isBlank()) {
                return null;
            }
            return objectMapper.readValue(json, clazz);
        } catch (RedisConnectionFailureException e) {
            log.warn("Redis unavailable, skip inference cache get. {}", e.getMessage());
            return null;
        } catch (Exception e) {
            log.warn("Read inference cache failed. {}", e.getMessage(), e);
            return null;
        }
    }

    public void put(String key, Object value) {
        put(key, value, DEFAULT_TTL);
    }

    public void put(String key, Object value, Duration ttl) {
        try {
            String json = objectMapper.writeValueAsString(value);
            redisTemplate.opsForValue().set(KEY_PREFIX + key, json, ttl);
        } catch (RedisConnectionFailureException e) {
            log.warn("Redis unavailable, skip inference cache put. {}", e.getMessage());
        } catch (Exception e) {
            log.warn("Save inference cache failed. {}", e.getMessage(), e);
        }
    }
}