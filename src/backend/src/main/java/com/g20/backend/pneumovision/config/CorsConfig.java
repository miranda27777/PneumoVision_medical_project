package com.g20.backend.pneumovision.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")  // 允许所有来源（开发用）
                .allowedMethods("*")         // 允许所有 HTTP 方法
                .allowedHeaders("*")         // 允许所有请求头
                .allowCredentials(true);     // 允许携带 cookie
    }
}