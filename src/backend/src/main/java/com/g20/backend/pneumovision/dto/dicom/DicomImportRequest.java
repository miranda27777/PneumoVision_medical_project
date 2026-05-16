package com.g20.backend.pneumovision.dto.dicom;

import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalTime;

@Data
public class DicomImportRequest {

    private MultipartFile file;

    private Long patientCaseId;

    private String caseNumber;

    private String patientName;

    private String patientIdDeidentified;

    private String gender;

    private Integer age;

    /**
     * 新建病例时的病例描述，保存到 PatientCase.remark。
     */
    private String caseDescription;

    private LocalDate studyDate;

    private LocalTime studyTime;

    private String modality;

    /**
     * 检查描述，保存到 Study.description。
     * 不传就是空，不再默认写“由 DICOM 智能导入”。
     */
    private String studyDescription;
}