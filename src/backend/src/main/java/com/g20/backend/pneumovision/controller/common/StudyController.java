package com.g20.backend.pneumovision.controller.common;

import com.g20.backend.pneumovision.common.exception.BusinessException;
import com.g20.backend.pneumovision.common.result.ApiResponse;
import com.g20.backend.pneumovision.dto.common.PageResponse;
import com.g20.backend.pneumovision.dto.study.StudyCreateRequest;
import com.g20.backend.pneumovision.dto.study.StudyDetailResponse;
import com.g20.backend.pneumovision.dto.study.StudyListItem;
import com.g20.backend.pneumovision.dto.study.StudyUpdateRequest;
import com.g20.backend.pneumovision.security.LoginUser;
import com.g20.backend.pneumovision.service.StudyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/**
 * 检查（Study）管理接口：嵌套在病例（PatientCase）下。
 */
@RestController
@RequestMapping("/api/cases/{caseId}/studies")
@RequiredArgsConstructor
@Validated
public class StudyController {

    private final StudyService studyService;

    @GetMapping
    public ApiResponse<PageResponse<StudyListItem>> listByPatientCaseId(
            @PathVariable Long caseId,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        LoginUser currentUser = getCurrentLoginUser();
        return ApiResponse.success(studyService.listByPatientCaseId(caseId, from, to, page, size, currentUser));
    }

    @PostMapping
    public ApiResponse<StudyDetailResponse> create(
            @PathVariable Long caseId,
            @Valid @RequestBody StudyCreateRequest request
    ) {
        LoginUser currentUser = getCurrentLoginUser();
        return ApiResponse.success(studyService.create(caseId, request, currentUser));
    }

    @GetMapping("/{studyId}")
    public ApiResponse<StudyDetailResponse> getById(
            @PathVariable Long caseId,
            @PathVariable Long studyId
    ) {
        LoginUser currentUser = getCurrentLoginUser();
        return ApiResponse.success(studyService.getById(caseId, studyId, currentUser));
    }

    @PutMapping("/{studyId}")
    public ApiResponse<StudyDetailResponse> update(
            @PathVariable Long caseId,
            @PathVariable Long studyId,
            @Valid @RequestBody StudyUpdateRequest request
    ) {
        LoginUser currentUser = getCurrentLoginUser();
        return ApiResponse.success(studyService.update(caseId, studyId, request, currentUser));
    }

    @DeleteMapping("/{studyId}")
    public ApiResponse<Void> delete(
            @PathVariable Long caseId,
            @PathVariable Long studyId
    ) {
        LoginUser currentUser = getCurrentLoginUser();
        studyService.delete(caseId, studyId, currentUser);
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

