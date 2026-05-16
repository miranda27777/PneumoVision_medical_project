package com.g20.backend.pneumovision.dto.inference;

import com.g20.backend.pneumovision.common.enums.DoctorEvaluationStatus;
import com.g20.backend.pneumovision.common.enums.InferenceStatusEnum;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 推理任务详情/列表返回 DTO
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InferenceTaskResponse {

    private Long id;

    private Long imageId;

    private Long studyId;

    private String modelId;

    private InferenceStatusEnum status;

    private Long durationMs;

    private String errorMessage;

    private Long createdBy;

    private LocalDateTime createdAt;

    private LocalDateTime startedAt;

    private LocalDateTime finishedAt;

    /** 医生评价说明 */
    private String reviewComment;

    private Long reviewedBy;

    DoctorEvaluationStatus doctorEvaluationStatus;

    private LocalDateTime reviewedAt;
}
