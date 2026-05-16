package com.g20.backend.pneumovision.dto.study;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class StudyUpdateRequest {

    private LocalDateTime studyTime;

    @Pattern(regexp = "DX|CR", message = "检查模态只能为 DX 或 CR")
    private String modality;

    @Size(max = 500, message = "检查描述长度不能超过 500")
    private String description;
}