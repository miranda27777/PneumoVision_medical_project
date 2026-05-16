package com.g20.backend.pneumovision.dto.audit;

import com.g20.backend.pneumovision.entity.AuditLog;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class AuditLogResponse {

    private Long id;
    private String action;
    private Long operatorId;
    private String operatorUsername;
    private String target;
    private String detail;
    private String ipAddress;
    private LocalDateTime createdAt;

    public static AuditLogResponse fromEntity(AuditLog log) {
        return AuditLogResponse.builder()
                .id(log.getId())
                .action(log.getAction())
                .operatorId(log.getOperatorId())
                .operatorUsername(log.getOperatorUsername())
                .target(log.getTarget())
                .detail(log.getDetail())
                .ipAddress(log.getIpAddress())
                .createdAt(log.getCreatedAt())
                .build();
    }
}
