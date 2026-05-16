package com.g20.backend.pneumovision.dto.inference;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 单个推理结果（检测框）返回 DTO。
 * 对应实体 {@link com.g20.backend.pneumovision.entity.InferenceResult}。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InferenceResultResponse {

    private Long id;

    private Long taskId;

    private Long imageId;

    private String label;

    private Double score;

    private Double x;

    private Double y;

    private Double width;

    private Double height;

    private String maskPath;

    private LocalDateTime createdAt;

}
