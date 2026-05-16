package com.g20.backend.pneumovision.dto.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class ModelParamsUpdateRequest {

    @DecimalMin(value = "0.0", message = "conf不能小于0")
    @DecimalMax(value = "1.0", message = "conf不能大于1")
    private Double conf;

    @DecimalMin(value = "0.0", message = "iou不能小于0")
    @DecimalMax(value = "1.0", message = "iou不能大于1")
    private Double iou;

    @Min(value = 1, message = "maxDet不能小于1")
    @Max(value = 10, message = "maxDet不能大于10")
    private Integer maxDet;

    @Min(value = 1, message = "topK不能小于1")
    @Max(value = 10, message = "topK不能大于10")
    private Integer topK;

    @JsonIgnore
    public boolean isEmpty() {
        return conf == null && iou == null && maxDet == null && topK == null;
    }
}