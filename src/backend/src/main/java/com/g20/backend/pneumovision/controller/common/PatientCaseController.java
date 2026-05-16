package com.g20.backend.pneumovision.controller.common;

import com.g20.backend.pneumovision.common.exception.BusinessException;
import com.g20.backend.pneumovision.common.result.ApiResponse;
import com.g20.backend.pneumovision.dto.common.PageResponse;
import com.g20.backend.pneumovision.dto.patientcase.*;
import com.g20.backend.pneumovision.security.LoginUser;
import com.g20.backend.pneumovision.service.PatientCaseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/**
 * 病例管理接口（PatientCase 域）。
 */
@RestController
@RequestMapping("/api/cases")
@RequiredArgsConstructor
@Validated
public class PatientCaseController {

    private final PatientCaseService patientCaseService;

    /**
     * 获取病例列表（支持按病例编号/患者姓名/时间范围检索）
     */
    @GetMapping
    public ApiResponse<PageResponse<PatientCaseListItem>> list(
            @RequestParam(required = false) String caseNumber,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        LoginUser currentUser = getCurrentLoginUser();
        return ApiResponse.success(patientCaseService.list(caseNumber, from, to, page, size, currentUser));
    }

    /**
     * 获取病例详情
     */
    @GetMapping("/{id}")
    public ApiResponse<PatientCaseDetailResponse> getById(@PathVariable Long id) {
        LoginUser currentUser = getCurrentLoginUser();
        return ApiResponse.success(patientCaseService.getById(id, currentUser));
    }

    /**
     * 查看患者敏感信息：姓名、患者编号
     * 默认列表/详情不返回明文，只有点击显示时调用该接口。
     */
    @GetMapping("/{id}/sensitive-info")
    public ApiResponse<PatientCaseSensitiveInfoResponse> getSensitiveInfo(@PathVariable Long id) {
        LoginUser currentUser = getCurrentLoginUser();
        return ApiResponse.success(patientCaseService.getSensitiveInfo(id, currentUser));
    }

    /**
     * 创建病例
     */
    @PostMapping
    public ApiResponse<PatientCaseDetailResponse> create(
            @Valid @RequestBody PatientCaseCreateRequest request
    ) {
        LoginUser currentUser = getCurrentLoginUser();
        return ApiResponse.success(patientCaseService.create(request, currentUser));
    }

    /**
     * 更新病例
     */
    @PutMapping("/{id}")
    public ApiResponse<PatientCaseDetailResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody PatientCaseUpdateRequest request
    ) {
        LoginUser currentUser = getCurrentLoginUser();
        return ApiResponse.success(patientCaseService.update(id, request, currentUser));
    }

    /**
     * 删除病例
     */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        LoginUser currentUser = getCurrentLoginUser();
        patientCaseService.delete(id, currentUser);
        return ApiResponse.success();
    }

    private LoginUser getCurrentLoginUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof LoginUser loginUser)) {
            throw new BusinessException("未登录或登录状态已失效");
        }
        return loginUser;
    }
}

