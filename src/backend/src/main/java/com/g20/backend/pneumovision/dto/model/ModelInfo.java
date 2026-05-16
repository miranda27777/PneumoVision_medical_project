package com.g20.backend.pneumovision.dto.model;

import lombok.Data;

@Data
public class ModelInfo {
    private String type;
    private String path;
    private Boolean enabled;
    private ModelParams params;
}
