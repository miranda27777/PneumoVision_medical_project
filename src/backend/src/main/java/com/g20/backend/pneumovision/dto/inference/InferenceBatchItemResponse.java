package com.g20.backend.pneumovision.dto.inference;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** 批量推理中单条影像的结果。 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InferenceBatchItemResponse {

    private Long imageId;

    /** 成功时有值 */
    private InferenceTaskResponse task;

    /** 失败时有值 */
    private String error;
}
