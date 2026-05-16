package com.g20.backend.pneumovision.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "inference_result")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InferenceResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 关联的推理任务 ID（InferenceTask.id）
     */
    @Column(name = "task_id", nullable = false)
    private Long taskId;

    /**
     * 关联的影像 ID（ImageAsset.id）
     */
    @Column(name = "image_id", nullable = false)
    private Long imageId;

    /**
     * 检测类别，比如 pneumonia
     */
    @Column(name = "label", length = 100, nullable = false)
    private String label;

    /**
     * 置信度
     */
    @Column(name = "score")
    private Double score;

    /**
     * 检测框坐标（可以是相对坐标或像素坐标，前后端统一约定）
     */
    @Column(name = "x")
    private Double x;

    @Column(name = "y")
    private Double y;

    @Column(name = "width")
    private Double width;

    @Column(name = "height")
    private Double height;

    /**
     * 掩码图路径（可选）
     */
    @Column(name = "mask_path", length = 500)
    private String maskPath;

    /**
     * 创建时间
     */
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }
}
