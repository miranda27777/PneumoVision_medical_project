package com.g20.backend.pneumovision.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "image_asset")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ImageAsset {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "study_id", nullable = false)
    private Long studyId;

    @Column(name = "patient_case_id", nullable = false)
    private Long patientCaseId;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "file_path", nullable = false, length = 500)
    private String filePath;

    @Column(name = "file_format", nullable = false, length = 20)
    private String fileFormat;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "uploaded_by", nullable = false)
    private Long uploadedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

}
