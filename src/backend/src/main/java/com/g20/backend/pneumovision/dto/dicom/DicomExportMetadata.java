package com.g20.backend.pneumovision.dto.dicom;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Data
@Builder
public class DicomExportMetadata {

    private String patientName;

    private String patientId;

    private String sex;

    private Integer age;

    private LocalDate studyDate;

    private LocalTime studyTime;

    private String modality;

    private String specificCharacterSet;

    private List<String> missingFields;

    private ImageInfo image;

    @Data
    @Builder
    public static class ImageInfo {
        private String fileName;
        private String fileFormat;
        private Integer width;
        private Integer height;
    }
}