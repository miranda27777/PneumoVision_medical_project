package com.g20.backend.pneumovision.dto.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class ModelParams {
    private Double conf;
    private Double iou;

    @JsonProperty("max_det")
    private Integer maxDet;

    @JsonProperty("top_k")
    private Integer topK;
}
