package com.g20.backend.pneumovision.dto.inference;

import lombok.Data;

@Data
public class CachedInferenceItem {
    private String label;
    private Double score;
    private Double x;
    private Double y;
    private Double width;
    private Double height;
    private String maskPath;
}