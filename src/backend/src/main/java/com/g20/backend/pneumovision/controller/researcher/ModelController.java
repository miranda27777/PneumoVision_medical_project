package com.g20.backend.pneumovision.controller.researcher;

import com.g20.backend.pneumovision.common.enums.AuditActionEnum;
import com.g20.backend.pneumovision.common.exception.BusinessException;
import com.g20.backend.pneumovision.common.result.ApiResponse;
import com.g20.backend.pneumovision.dto.model.ModelInfo;
import com.g20.backend.pneumovision.dto.model.ModelParamsUpdateRequest;
import com.g20.backend.pneumovision.security.LoginUser;
import com.g20.backend.pneumovision.service.AuditService;
import com.g20.backend.pneumovision.service.ModelService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 模型管理：
 * - 查询模型列表
 * - 更新模型参数
 * - 启用模型
 * - 禁用模型
 */
@RestController
@RequestMapping("/api/models")
@RequiredArgsConstructor
@Validated
public class ModelController {

    private final ModelService modelService;
    private final AuditService auditService;

    /**
     * 查询模型列表 / 模型配置
     */
    @GetMapping
    public ApiResponse<Map<String, ModelInfo>> listModels() {
        LoginUser currentUser = getCurrentLoginUser();
        auditService.log(AuditActionEnum.RESEARCHER_MODEL_VIEW, currentUser.getId(), currentUser.getUsername(),
                "models", "科研人员查看模型列表", null);
        return ApiResponse.success(modelService.listModels());
    }

    /**
     * 更新模型参数（支持部分更新）
     */
    @PutMapping("/{modelId}/params")
    public ApiResponse<String> updateModelParams(
            @PathVariable String modelId,
            @Valid @RequestBody ModelParamsUpdateRequest request
    ) {
        LoginUser currentUser = getCurrentLoginUser();
        auditService.log(AuditActionEnum.RESEARCHER_MODEL_UPDATE, currentUser.getId(), currentUser.getUsername(),
                "model:" + modelId, "科研人员更新模型参数", null);
        return ApiResponse.success(modelService.updateModelParams(modelId, request));
    }

    /**
     * 启用模型
     */
    @PutMapping("/{modelId}/enable")
    public ApiResponse<String> enableModel(@PathVariable String modelId) {
        LoginUser currentUser = getCurrentLoginUser();
        auditService.log(AuditActionEnum.RESEARCHER_MODEL_ENABLE, currentUser.getId(), currentUser.getUsername(),
                "model:" + modelId, "科研人员启用模型:"+modelId, null);
        return ApiResponse.success(modelService.enableModel(modelId));
    }

    /**
     * 禁用模型
     */
    @PutMapping("/{modelId}/disable")
    public ApiResponse<String> disableModel(@PathVariable String modelId) {
        LoginUser currentUser = getCurrentLoginUser();
        auditService.log(AuditActionEnum.RESEARCHER_MODEL_DISABLE, currentUser.getId(), currentUser.getUsername(),
                "model:" + modelId, "科研人员禁用模型:"+modelId, null);
        return ApiResponse.success(modelService.disableModel(modelId));
    }

    private LoginUser getCurrentLoginUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof LoginUser loginUser)) {
            throw new BusinessException("未登录或登录状态已失效");
        }
        return loginUser;
    }
}