package com.g20.backend.pneumovision.entity;

import com.g20.backend.pneumovision.security.SensitiveStringEncryptConverter;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "patient_case")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PatientCase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "case_number", nullable = false, unique = true, length = 50)
    private String caseNumber;

    @Convert(converter = SensitiveStringEncryptConverter.class)
    @Column(name = "patient_name", length = 1024)
    private String patientName;

    @Convert(converter = SensitiveStringEncryptConverter.class)
    @Column(name = "patient_id_deidentified", length = 1024)
    private String patientIdDeidentified;

    @Column(name = "gender")
    private String gender;

    @Column(name = "age")
    private Integer age;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "remark", length = 500)
    private String remark;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}