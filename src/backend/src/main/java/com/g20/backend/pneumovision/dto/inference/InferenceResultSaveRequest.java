package com.g20.backend.pneumovision.dto.inference;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class InferenceResultSaveRequest {

    @Valid
    @NotNull(message = "检测框列表不能为空")
    private List<InferenceResultSaveItem> results;
}