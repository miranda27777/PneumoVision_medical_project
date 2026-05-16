package com.g20.backend.pneumovision.dto.inference;

import com.g20.backend.pneumovision.common.enums.ModelIdEnum;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 创建推理任务的请求 DTO
 */
@Data
public class InferenceTaskCreateRequest {

    /**
     * 目标影像 ID（ImageAsset.id）
     */
    @NotNull(message = "影像 ID 不能为空")
    private Long imageId;

    /**
     * 使用的模型标识
     */
    @NotNull(message = "模型名称不能为空")
    private ModelIdEnum modelId;
}
