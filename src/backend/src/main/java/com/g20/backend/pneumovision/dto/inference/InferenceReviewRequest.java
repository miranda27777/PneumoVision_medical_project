package com.g20.backend.pneumovision.dto.inference;

import com.g20.backend.pneumovision.common.enums.DoctorEvaluationStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 医生对推理任务整体结果的评价请求 DTO。
 */
@Data
public class InferenceReviewRequest {

    /**
     * 医生认为本次推理结果是否基本正确。
     */
    @NotNull(message = "评价结论不能为空")
    private DoctorEvaluationStatus evaluationStatus;

    /**
     * 医生的简要评价说明，可选。
     */
    @Size(max = 500, message = "评价内容最长 500 字符")
    private String comment;
}
