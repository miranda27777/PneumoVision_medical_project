package com.g20.backend.pneumovision.entity;

import com.g20.backend.pneumovision.common.enums.DoctorEvaluationStatus;
import com.g20.backend.pneumovision.common.enums.InferenceStatusEnum;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "inference_task")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InferenceTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 关联的影像 ID（ImageAsset.id）
     */
    @Column(name = "image_id", nullable = false)
    private Long imageId;

    /**
     * 冗余存储的检查 ID（Study.id），方便按检查维度查询
     */
    @Column(name = "study_id", nullable = false)
    private Long studyId;

    /**
     * 使用的模型标识，如 pneumo_v1
     */
    @Column(name = "model_id", length = 100, nullable = false)
    private String modelId;


    /**
     * 任务状态：PENDING / RUNNING / SUCCESS / FAILED
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20, nullable = false)
    private InferenceStatusEnum status;

    /**
     * 失败时的错误信息
     */
    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    /**
     * 推理耗时（毫秒）
     */
    @Column(name = "duration_ms")
    private Long durationMs;

    /**
     * 发起人用户 ID
     */
    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    /**
     * 创建时间
     */
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /**
     * 开始推理时间
     */
    @Column(name = "started_at")
    private LocalDateTime startedAt;

    /**
     * 结束推理时间
     */
    @Column(name = "finished_at")
    private LocalDateTime finishedAt;


    /**
     * 医生评价内容
     */
    @Column(name = "review_comment", length = 500)
    private String reviewComment;

    /**
     * 医生评价人 ID
     */
    @Column(name = "reviewed_by")
    private Long reviewedBy;

    /**
     * 医生评价时间
     */
    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "doctor_evaluation_status", length = 30)
    private DoctorEvaluationStatus doctorEvaluationStatus;

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.status == null) {
            this.status = InferenceStatusEnum.PENDING;
        }
    }
}
