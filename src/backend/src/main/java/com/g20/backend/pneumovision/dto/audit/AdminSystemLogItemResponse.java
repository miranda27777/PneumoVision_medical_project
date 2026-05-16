package com.g20.backend.pneumovision.dto.audit;

import com.g20.backend.pneumovision.entity.AuditLog;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class AdminSystemLogItemResponse {

    /** 日志时间 */
    private LocalDateTime time;
    /** 操作用户（用户名） */
    private String user;
    /** 操作类型 */
    private String action;
    /** 操作状态：SUCCESS / FAILED */
    private String status;

    public static AdminSystemLogItemResponse fromEntity(AuditLog log) {
        String detail = log.getDetail();
        String status = (detail != null && detail.contains("失败")) ? "FAILED" : "SUCCESS";
        return AdminSystemLogItemResponse.builder()
                .time(log.getCreatedAt())
                .user(log.getOperatorUsername())
                .action(log.getAction())
                .status(status)
                .build();
    }
}
