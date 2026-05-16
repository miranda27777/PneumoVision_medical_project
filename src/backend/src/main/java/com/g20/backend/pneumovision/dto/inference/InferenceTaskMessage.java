package com.g20.backend.pneumovision.dto.inference;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InferenceTaskMessage {
    private Long taskId;
    private Long imageId;
    private Long studyId;
    private String modelId;
    private Long createdBy;
    private LocalDateTime requestedAt;
    private Integer retryCount;
}
