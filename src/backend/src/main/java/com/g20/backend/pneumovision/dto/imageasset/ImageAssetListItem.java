package com.g20.backend.pneumovision.dto.imageasset;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ImageAssetListItem {

    private Long id;

    private Long studyId;

    private Long patientCaseId;

    private String caseNumber;

    private String patientIdDeidentified;

    private LocalDateTime studyTime;

    private String modality;

    private String fileName;

    private String filePath;

    private String fileFormat;

    private Long fileSize;

    private Long uploadedBy;

    private LocalDateTime createdAt;

    // ===== 新增：当前图片对应的最新检测任务信息 =====
    private Long taskId;

    private String taskStatus;

    private String doctorEvaluationStatus;

    private String resultLabel;
}