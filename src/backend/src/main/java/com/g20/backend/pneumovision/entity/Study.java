package com.g20.backend.pneumovision.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "study")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Study {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "patient_case_id", nullable = false)
    private Long patientCaseId;

    @Column(name = "study_time", nullable = false)
    private LocalDateTime studyTime;

    @Column(name = "modality", nullable = false, length = 10)
    private String modality;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
