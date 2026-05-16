package com.g20.backend.pneumovision.dto.audit;

import lombok.Data;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class AuditLogQueryRequest {

    /**
     * 按操作用户名模糊查询
     */
    private String username;

    /**
     * 查询某一天
     * 例如：2026-04-22
     */
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate date;

    /**
     * 查询范围开始时间
     * 例如：2026-04-20T00:00:00
     */
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime startTime;

    /**
     * 查询范围结束时间
     * 例如：2026-04-22T23:59:59
     */
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime endTime;
}