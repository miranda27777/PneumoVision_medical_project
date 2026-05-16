package com.g20.backend.pneumovision.controller.doctor;

import com.g20.backend.pneumovision.common.enums.AuditActionEnum;
import com.g20.backend.pneumovision.common.exception.BusinessException;
import com.g20.backend.pneumovision.common.result.ApiResponse;
import com.g20.backend.pneumovision.dto.inference.InferenceResultResponse;
import com.g20.backend.pneumovision.dto.inference.InferenceResultSaveRequest;
import com.g20.backend.pneumovision.dto.inference.InferenceReviewRequest;
import com.g20.backend.pneumovision.dto.inference.InferenceBatchCreateRequest;
import com.g20.backend.pneumovision.dto.inference.InferenceBatchItemResponse;
import com.g20.backend.pneumovision.dto.inference.InferenceExportResponse;
import com.g20.backend.pneumovision.dto.inference.InferenceTaskCreateRequest;
import com.g20.backend.pneumovision.dto.inference.InferenceTaskResponse;
import com.g20.backend.pneumovision.security.LoginUser;
import com.g20.backend.pneumovision.service.InferenceExportPdfService;
import com.g20.backend.pneumovision.service.AuditService;
import com.g20.backend.pneumovision.service.InferenceTaskBatchService;
import com.g20.backend.pneumovision.service.InferenceTaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 推理任务相关接口：
 * - 发起肺炎检测推理
 * - 查询任务详情
 * - 按影像 / 检查维度查看历史任务
 */
@RestController
@RequestMapping("/api/inference/tasks")
@RequiredArgsConstructor
@Validated
public class InferenceTaskController {

    private final InferenceTaskService inferenceTaskService;
    private final InferenceTaskBatchService inferenceTaskBatchService;
    private final InferenceExportPdfService inferenceExportPdfService;
    private final AuditService auditService;

    /** 按影像 ID 列表批量创建推理任务。 */
    @PostMapping("/batch")
    public ApiResponse<List<InferenceBatchItemResponse>> createTasksBatch(
            @Valid @RequestBody InferenceBatchCreateRequest request
    ) {
        LoginUser currentUser = getCurrentLoginUser();
        return ApiResponse.success(inferenceTaskBatchService.createTasks(request, currentUser));
    }

    /**
     * 创建推理任务（发起肺炎检测）
     */
    @PostMapping
    public ApiResponse<InferenceTaskResponse> createTask(@Valid @RequestBody InferenceTaskCreateRequest request) {
        LoginUser currentUser = getCurrentLoginUser();
        return ApiResponse.success(inferenceTaskService.createTask(request, currentUser));
    }

    /** 导出推理结果（时间、结论、明细、原图与带框图 URL）。 */
    @GetMapping("/{taskId}/export")
    public ApiResponse<InferenceExportResponse> exportResult(@PathVariable Long taskId) {
        LoginUser currentUser = getCurrentLoginUser();
        logResearcherInferenceAction(currentUser, AuditActionEnum.RESEARCHER_EXPORT_RESULT,
                "task:" + taskId, "科研人员导出推理结果(JSON)");
        return ApiResponse.success(inferenceTaskService.exportResult(taskId, currentUser));
    }

    /** 带检测框的 PNG 预览（与 export 中 inferenceOverlayUrl 对应）。 */
    @GetMapping("/{taskId}/overlay-preview")
    public ResponseEntity<byte[]> overlayPreview(@PathVariable Long taskId) {
        LoginUser currentUser = getCurrentLoginUser();
        byte[] png = inferenceTaskService.renderOverlayPreview(taskId, currentUser);
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .body(png);
    }

    /** 导出 PDF 报告（检测时间、结论与明细、原图、推理标注图），浏览器可直接下载。 */
    @GetMapping("/{taskId}/export-pdf")
    public ResponseEntity<byte[]> exportPdfReport(@PathVariable Long taskId) {
        LoginUser currentUser = getCurrentLoginUser();
        logResearcherInferenceAction(currentUser, AuditActionEnum.RESEARCHER_EXPORT_RESULT,
                "task:" + taskId, "科研人员导出推理结果(PDF)");
        byte[] pdf = inferenceExportPdfService.buildExportPdf(taskId, currentUser);
        String filename = "inference-report-" + taskId + ".pdf";
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(pdf);
    }

    /**
     * 根据任务 ID 查询任务详情
     */
    @GetMapping("/{taskId}")
    public ApiResponse<InferenceTaskResponse> getTask(@PathVariable Long taskId) {
        LoginUser currentUser = getCurrentLoginUser();
        logResearcherInferenceAction(currentUser, AuditActionEnum.RESEARCHER_VIEW_INFERENCE,
                "task:" + taskId, "科研人员查看推理任务详情");
        return ApiResponse.success(inferenceTaskService.getTask(taskId, currentUser));
    }

    /**
     * 按影像 ID 或检查 ID 查询任务列表（至少传一个）
     */
    @GetMapping
    public ApiResponse<List<InferenceTaskResponse>> listTasks(
            @RequestParam(required = false) Long imageId,
            @RequestParam(required = false) Long studyId
    ) {
        LoginUser currentUser = getCurrentLoginUser();
        logResearcherInferenceAction(currentUser, AuditActionEnum.RESEARCHER_VIEW_INFERENCE,
                imageId != null ? "image:" + imageId : "study:" + studyId, "科研人员查看推理任务列表");
        if (imageId != null) {
            return ApiResponse.success(inferenceTaskService.listByImageId(imageId, currentUser));
        }
        if (studyId != null) {
            return ApiResponse.success(inferenceTaskService.listByStudyId(studyId, currentUser));
        }
        throw new BusinessException("必须提供 imageId 或 studyId 之一");
    }

    /**
     * 获取指定任务的推理结果列表（检测框等）
     */
    @GetMapping("/{taskId}/results")
    public ApiResponse<List<InferenceResultResponse>> listResults(@PathVariable Long taskId) {
        LoginUser currentUser = getCurrentLoginUser();
        logResearcherInferenceAction(currentUser, AuditActionEnum.RESEARCHER_VIEW_INFERENCE,
                "task:" + taskId, "科研人员查看推理检测框结果");
        return ApiResponse.success(inferenceTaskService.listResults(taskId, currentUser));
    }


    /**
     * 保存医生修正后的检测框结果：
     * - 支持修改旧框
     * - 支持新增框
     * - 支持删除框（前端不传的旧框会被删除）
     */
    @PutMapping("/{taskId}/results")
    public ApiResponse<List<InferenceResultResponse>> saveResults(
            @PathVariable Long taskId,
            @Valid @RequestBody InferenceResultSaveRequest request
    ) {
        LoginUser currentUser = getCurrentLoginUser();
        return ApiResponse.success(inferenceTaskService .saveResults(taskId, request, currentUser));
    }

    /**
     * 医生对推理任务进行整体评价
     */
    @PostMapping("/{taskId}/review")
    public ApiResponse<Void> reviewTask(
            @PathVariable Long taskId,
            @Valid @RequestBody InferenceReviewRequest request
    ) {
        LoginUser currentUser = getCurrentLoginUser();
        inferenceTaskService.reviewTask(taskId, request, currentUser);
        return ApiResponse.success();
    }

    private LoginUser getCurrentLoginUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof LoginUser loginUser)) {
            throw new BusinessException("未登录或登录状态已失效");
        }
        return loginUser;
    }

    private void logResearcherInferenceAction(LoginUser currentUser, AuditActionEnum action, String target, String detail) {
        if (!"RESEARCHER".equals(currentUser.getRole())) {
            return;
        }
        auditService.log(action, currentUser.getId(), currentUser.getUsername(), target, detail, null);
    }
}

