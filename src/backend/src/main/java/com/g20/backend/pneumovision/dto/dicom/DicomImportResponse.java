package com.g20.backend.pneumovision.dto.dicom;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DicomImportResponse {

    private Long patientCaseId;

    private String caseNumber;

    private Long studyId;

    private Long imageId;

    /**
     * true：本次自动新建病例。
     * false：挂载到已有病例。
     */
    private Boolean createdNewCase;

    /**
     * DICOM 解析出来的原始信息。
     */
    private DicomParseResponse parsed;
}