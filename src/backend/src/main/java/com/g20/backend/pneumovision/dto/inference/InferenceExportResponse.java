package com.g20.backend.pneumovision.dto.inference;

import com.g20.backend.pneumovision.common.enums.InferenceStatusEnum;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/** 推理结果导出（时间、结论、明细、原图与带框图访问路径）。 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InferenceExportResponse {

    private String caseNumber;

    private Long studyId;

    private Long imageId;

    private Long taskId;

    /** 检测完成时间，未完成时用开始时间 */
    private LocalDateTime detectionTime;

    private InferenceStatusEnum status;

    /** 用于列表/标题展示的简要结论 */
    private String summaryLabel;

    private List<InferenceResultResponse> results;

    /** 原图预览相对路径，需带鉴权请求 */
    private String originalImageUrl;

    /** 带检测框 PNG 预览相对路径；不支持绘制时为 null */
    private String inferenceOverlayUrl;

    private String errorMessage;
}
