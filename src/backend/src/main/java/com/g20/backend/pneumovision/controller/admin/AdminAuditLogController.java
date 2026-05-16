package com.g20.backend.pneumovision.controller.admin;

import com.g20.backend.pneumovision.common.enums.AuditActionEnum;
import com.g20.backend.pneumovision.common.exception.BusinessException;
import com.g20.backend.pneumovision.common.result.ApiResponse;
import com.g20.backend.pneumovision.dto.audit.AdminSystemLogItemResponse;
import com.g20.backend.pneumovision.dto.audit.AuditLogQueryRequest;
import com.g20.backend.pneumovision.dto.common.PageResponse;
import com.g20.backend.pneumovision.entity.AuditLog;
import com.g20.backend.pneumovision.security.LoginUser;
import com.g20.backend.pneumovision.service.AuditService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/audit-logs")
@RequiredArgsConstructor
public class AdminAuditLogController {

    private final AuditService auditService;

    /**
     * 系统管理员查看系统日志。
     * 支持按用户名、某一天、时间范围筛选。
     */
    @GetMapping
    public ApiResponse<PageResponse<AdminSystemLogItemResponse>> listSystemLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @ModelAttribute AuditLogQueryRequest query
    ) {
        // 只做鉴权，不记录“查看日志”行为，避免分页查询导致日志自增。
        getCurrentLoginUser();

        if (query.getDate() != null && (query.getStartTime() != null || query.getEndTime() != null)) {
            throw new BusinessException("不能同时传 date 和 startTime/endTime，请选择一种时间筛选方式");
        }

        if (query.getStartTime() != null
                && query.getEndTime() != null
                && query.getStartTime().isAfter(query.getEndTime())) {
            throw new BusinessException("开始时间不能晚于结束时间");
        }

        Pageable pageable = PageRequest.of(Math.max(page, 0), clampSize(size));
        Page<AuditLog> logs = auditService.searchLogs(query, pageable);
        Page<AdminSystemLogItemResponse> mapped = logs.map(AdminSystemLogItemResponse::fromEntity);
        return ApiResponse.success(PageResponse.from(mapped));
    }

    private int clampSize(int size) {
        if (size <= 0) return 20;
        return Math.min(size, 100);
    }

    private LoginUser getCurrentLoginUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof LoginUser loginUser)) {
            throw new BusinessException("未登录或登录状态已失效");
        }
        return loginUser;
    }
}
