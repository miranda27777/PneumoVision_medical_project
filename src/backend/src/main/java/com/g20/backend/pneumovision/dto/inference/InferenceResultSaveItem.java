package com.g20.backend.pneumovision.dto.inference;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class InferenceResultSaveItem {

    private Long id;

    private String label;

    @DecimalMin(value = "0.0", message = "置信度不能小于0")
    @DecimalMax(value = "1.0", message = "置信度不能大于1")
    private Double score;

    @NotNull(message = "x坐标不能为空")
    @DecimalMin(value = "0.0", message = "x坐标不能小于0")
    private Double x;

    @NotNull(message = "y坐标不能为空")
    @DecimalMin(value = "0.0", message = "y坐标不能小于0")
    private Double y;

    @NotNull(message = "宽度不能为空")
    @DecimalMin(value = "0.000001", message = "宽度必须大于0")
    private Double width;

    @NotNull(message = "高度不能为空")
    @DecimalMin(value = "0.000001", message = "高度必须大于0")
    private Double height;

    private String maskPath;
}