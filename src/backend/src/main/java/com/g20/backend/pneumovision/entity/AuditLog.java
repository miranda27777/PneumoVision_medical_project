package com.g20.backend.pneumovision.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 操作类型：LOGIN, USER_CREATE, USER_DISABLE, USER_ENABLE, VIEW_AUDIT_LOG 等 */
    @Column(nullable = false, length = 32)
    private String action;

    @Column(name = "operator_id")
    private Long operatorId;

    @Column(name = "operator_username", length = 50)
    private String operatorUsername;

    @Column(length = 200)
    private String target;  // 操作对象描述，如 "用户: doctor01"

    @Column(length = 500)
    private String detail;  // 补充说明

    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @Column(name = "created_at", nullable = false, updatable = false)
    private java.time.LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = java.time.LocalDateTime.now();
    }
}
