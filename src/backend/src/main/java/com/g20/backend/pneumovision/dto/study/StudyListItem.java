package com.g20.backend.pneumovision.dto.study;

import com.g20.backend.pneumovision.entity.Study;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudyListItem {

    private Long id;

    private Long patientCaseId;

    private LocalDateTime studyTime;

    private String modality;

    private String description;

    private LocalDateTime createdAt;

    public static StudyListItem fromEntity(Study entity) {
        if (entity == null) {
            return null;
        }
        return StudyListItem.builder()
                .id(entity.getId())
                .patientCaseId(entity.getPatientCaseId())
                .studyTime(entity.getStudyTime())
                .modality(entity.getModality())
                .description(entity.getDescription())
                .createdAt(entity.getCreatedAt())
                .build();
    }

}
