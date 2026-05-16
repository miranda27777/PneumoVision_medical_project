package com.g20.backend.pneumovision.dto.inference;

import com.g20.backend.pneumovision.common.enums.ModelIdEnum;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/** 批量创建推理任务的请求体。 */
@Data
public class InferenceBatchCreateRequest {

    @NotEmpty(message = "影像 ID 列表不能为空")
    @Size(max = 50, message = "单次批量不超过 50 张影像")
    private List<@NotNull(message = "影像 ID 不能为 null") Long> imageIds;

    @NotNull(message = "模型名称不能为空")
    private ModelIdEnum modelId;

}
