package com.g20.backend.pneumovision.controller.common;

import com.g20.backend.pneumovision.common.enums.AuditActionEnum;
import com.g20.backend.pneumovision.common.exception.BusinessException;
import com.g20.backend.pneumovision.common.result.ApiResponse;
import com.g20.backend.pneumovision.dto.common.PageResponse;
import com.g20.backend.pneumovision.dto.imageasset.ImageAssetBatchUploadItemResponse;
import com.g20.backend.pneumovision.dto.imageasset.ImageAssetDetailResponse;
import com.g20.backend.pneumovision.dto.imageasset.ImageBatchUploadRequest;
import com.g20.backend.pneumovision.dto.imageasset.ImageAssetListItem;
import com.g20.backend.pneumovision.dto.imageasset.ImageAssetSearchRequest;
import com.g20.backend.pneumovision.dto.imageasset.ImageAssetUploadRequest;
import com.g20.backend.pneumovision.security.LoginUser;
import com.g20.backend.pneumovision.service.AuditService;
import com.g20.backend.pneumovision.service.ImageAssetService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

@RestController
@RequestMapping("/api/images")
@RequiredArgsConstructor
@Validated
public class ImageAssetController {

    private final ImageAssetService imageAssetService;
    private final AuditService auditService;

    /**
     * 浏览所有影像
     */
    @GetMapping
    public ApiResponse<PageResponse<ImageAssetListItem>> listAll(
            @ModelAttribute ImageAssetSearchRequest request,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        LoginUser currentUser = getCurrentLoginUser();
        logResearcherImageAction(currentUser, "images", "科研人员浏览影像列表");
        return ApiResponse.success(imageAssetService.listAll(request, page, size, currentUser));
    }

    /**
     * 查看单个影像详情
     */
    @GetMapping("/{id}")
    public ApiResponse<ImageAssetDetailResponse> getById(@PathVariable Long id) {
        LoginUser currentUser = getCurrentLoginUser();
        logResearcherImageAction(currentUser, "image:" + id, "科研人员查看影像详情");
        return ApiResponse.success(imageAssetService.getById(id, currentUser));
    }

    /**
     * 根据检查ID查看影像列表
     */
    @GetMapping("/study/{studyId}")
    public ApiResponse<PageResponse<ImageAssetListItem>> listByStudyId(
            @PathVariable Long studyId,
            @ModelAttribute ImageAssetSearchRequest request,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        LoginUser currentUser = getCurrentLoginUser();
        logResearcherImageAction(currentUser, "study:" + studyId, "科研人员按检查查看影像");
        return ApiResponse.success(imageAssetService.listByStudyId(studyId, request, page, size, currentUser));
    }

    /**
     * 检索影像
     * 支持 keyword / fileFormat / studyId / uploadedBy
     */
    @GetMapping("/search")
    public ApiResponse<PageResponse<ImageAssetListItem>> search(
            @ModelAttribute ImageAssetSearchRequest request,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        LoginUser currentUser = getCurrentLoginUser();
        return ApiResponse.success(imageAssetService.search(request, page, size, currentUser));
    }

    /**
     * 上传影像文件。
     * 请求方式：multipart/form-data
     * 参数包括：
     * 1. studyId
     * 2. file
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ImageAssetDetailResponse> upload(
            @RequestParam("studyId") @NotNull(message = "检查 ID 不能为空") Long studyId,
            @RequestParam("file") @NotNull(message = "上传文件不能为空") MultipartFile file
    ) {
        ImageAssetUploadRequest request = new ImageAssetUploadRequest();
        request.setStudyId(studyId);
        request.setFile(file);
        LoginUser loginUser = getCurrentLoginUser();
        return ApiResponse.success(imageAssetService.upload(request, loginUser));
    }

    /** 同一检查下批量上传影像（multipart：studyId + 多个 files）。 */
    @Operation(summary = "批量上传影像")
    @PostMapping(value = "/upload-batch", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<List<ImageAssetBatchUploadItemResponse>> uploadBatch(
            @Valid @ModelAttribute ImageBatchUploadRequest form
    ) {
        LoginUser loginUser = getCurrentLoginUser();
        MultipartFile[] files = form.getFiles().toArray(new MultipartFile[0]);
        return ApiResponse.success(imageAssetService.uploadBatch(files, form.getStudyId(), loginUser));
    }

    /**
     * 根据影像 ID 预览/下载实际文件内容。
     * 根据文件后缀返回合适的 Content-Type：
     * - png/jpg/jpeg -> image/*
     * - dcm 及其他 -> application/octet-stream
     */
    @GetMapping("/{id}/preview")
    public ResponseEntity<Resource> preview(@PathVariable Long id) {
        LoginUser currentUser = getCurrentLoginUser();
        logResearcherImageAction(currentUser, "image:" + id, "科研人员预览影像");
        ImageAssetDetailResponse detail = imageAssetService.getById(id, currentUser);

        Path filePath = Paths.get(detail.getFilePath());
        if (!Files.exists(filePath)) {
            throw new BusinessException("影像文件不存在");
        }

        try {
            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new BusinessException("影像文件无法读取");
            }

            String contentType = resolveContentType(detail.getFileFormat());
            String disposition = "inline; filename=\"" + detail.getFileName() + "\"";

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
                    .body(resource);
        } catch (MalformedURLException e) {
            throw new BusinessException("影像文件路径无效");
        }
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        LoginUser currentUser = getCurrentLoginUser();
        imageAssetService.deleteById(id, currentUser);
        return ApiResponse.success(null);
    }

    private LoginUser getCurrentLoginUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof LoginUser loginUser)) {
            throw new BusinessException("未登录或登录状态已失效");
        }
        return loginUser;
    }

    private void logResearcherImageAction(LoginUser currentUser, String target, String detail) {
        if (!"RESEARCHER".equals(currentUser.getRole())) {
            return;
        }
        auditService.log(AuditActionEnum.RESEARCHER_VIEW_IMAGE, currentUser.getId(), currentUser.getUsername(),
                target, detail, null);
    }

    private String resolveContentType(String format) {
        if (format == null) {
            return MediaType.APPLICATION_OCTET_STREAM_VALUE;
        }
        String ext = format.toLowerCase();
        return switch (ext) {
            case "png" -> MediaType.IMAGE_PNG_VALUE;
            case "jpg", "jpeg" -> MediaType.IMAGE_JPEG_VALUE;
            default -> MediaType.APPLICATION_OCTET_STREAM_VALUE;
        };
    }

}