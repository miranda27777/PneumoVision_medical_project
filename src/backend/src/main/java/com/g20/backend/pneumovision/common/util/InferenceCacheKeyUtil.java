package com.g20.backend.pneumovision.common.util;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.Map;

public class InferenceCacheKeyUtil {

    private static final String CACHE_VERSION = "v1";

    private InferenceCacheKeyUtil() {
    }

    public static String sha256(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(data);
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("计算 SHA-256 失败", e);
        }
    }

    public static String buildParamsHash(
            ObjectMapper objectMapper,
            Double conf,
            Double iou,
            Integer maxDet,
            Integer topK
    ) {
        try {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("conf", conf);
            map.put("iou", iou);
            map.put("maxDet", maxDet);
            map.put("topK", topK);
            String json = objectMapper.writeValueAsString(map);
            return sha256(json.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new RuntimeException("生成参数哈希失败", e);
        }
    }

    public static String buildKey(String modelId, String paramsHash, String imageHash) {
        return CACHE_VERSION + ":" + modelId + ":" + paramsHash + ":" + imageHash;
    }
}