package com.g20.backend.pneumovision.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app.jwt")
public class JwtProperties {

    private String secret = "pneumovision-default-secret-change-in-production";
    private long expirationMs = 86400000; // 24 hours
}
