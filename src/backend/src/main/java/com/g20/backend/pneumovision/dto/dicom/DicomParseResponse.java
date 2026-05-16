package com.g20.backend.pneumovision.dto.dicom;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Data
@Builder
public class DicomParseResponse {

    /**
     * DICOM PatientName
     */
    private String patientName;

    /**
     * DICOM PatientID
     */
    private String patientId;

    /**
     * 已转换后的性别：男 / 女 / 其他
     */
    private String sex;

    /**
     * 年龄，单位：岁
     */
    private Integer age;

    /**
     * DICOM StudyDate
     */
    private LocalDate studyDate;

    /**
     * DICOM StudyTime
     */
    private LocalTime studyTime;

    /**
     * DICOM Modality，例如 CR / DX / CT
     */
    private String modality;

    /**
     * DICOM Specific Character Set，用来排查中文乱码问题
     */
    private String specificCharacterSet;

    /**
     * 没有从 DICOM 中解析到的字段，前端可以据此提示用户补充
     */
    private List<String> missingFields;
}