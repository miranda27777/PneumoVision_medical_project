package com.g20.backend.pneumovision.controller.common;

import com.g20.backend.pneumovision.common.exception.BusinessException;
import com.g20.backend.pneumovision.common.result.ApiResponse;
import com.g20.backend.pneumovision.dto.dicom.DicomImportRequest;
import com.g20.backend.pneumovision.dto.dicom.DicomImportResponse;
import com.g20.backend.pneumovision.dto.dicom.DicomParseResponse;
import com.g20.backend.pneumovision.security.LoginUser;
import com.g20.backend.pneumovision.service.DicomImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalTime;

@RestController
@RequestMapping("/api/dicom")
@RequiredArgsConstructor
public class DicomController {

    private final DicomImportService dicomImportService;

    /**
     * 解析 DICOM 元数据，只解析，不入库。
     */
    @PostMapping(value = "/parse", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<DicomParseResponse> parse(@RequestPart("file") MultipartFile file) {
        LoginUser currentUser = getCurrentLoginUser();
        return ApiResponse.success(dicomImportService.parse(file, currentUser));
    }

    /**
     * 智能导入。
     *
     * file 放 Body -> form-data。
     * 其他普通字段建议放 Params。
     */
    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<DicomImportResponse> importDicom(
            @RequestPart("file") MultipartFile file,

            @RequestParam(required = false) Long patientCaseId,

            @RequestParam(required = false) String caseNumber,
            @RequestParam(required = false) String patientName,
            @RequestParam(required = false) String patientIdDeidentified,
            @RequestParam(required = false) String gender,
            @RequestParam(required = false) Integer age,
            @RequestParam(required = false) String caseDescription,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate studyDate,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.TIME)
            LocalTime studyTime,

            @RequestParam(required = false) String modality,
            @RequestParam(required = false) String studyDescription
    ) {
        LoginUser currentUser = getCurrentLoginUser();

        DicomImportRequest request = new DicomImportRequest();
        request.setFile(file);
        request.setPatientCaseId(patientCaseId);
        request.setCaseNumber(caseNumber);
        request.setPatientName(patientName);
        request.setPatientIdDeidentified(patientIdDeidentified);
        request.setGender(gender);
        request.setAge(age);
        request.setCaseDescription(caseDescription);
        request.setStudyDate(studyDate);
        request.setStudyTime(studyTime);
        request.setModality(modality);
        request.setStudyDescription(studyDescription);

        return ApiResponse.success(dicomImportService.importDicom(request, currentUser));
    }

    /**
     * 导出 DICOM 解析结果。
     *
     * 上传 DCM，返回 zip。
     * zip 内容：
     * 1. metadata.json
     * 2. image.png
     *
     * 不创建 PatientCase，不创建 Study，不创建 ImageAsset。
     */
    @PostMapping(value = "/export", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<byte[]> exportDicom(@RequestPart("file") MultipartFile file) {
        LoginUser currentUser = getCurrentLoginUser();

        DicomImportService.DicomExportZip exportZip =
                dicomImportService.exportDicomAsZip(file, currentUser);

        String contentDisposition = buildContentDisposition(exportZip.fileName());

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition)
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(exportZip.bytes().length)
                .body(exportZip.bytes());
    }

    /**
     * 构造支持中文文件名的 Content-Disposition。
     *
     * 返回格式类似：
     * attachment; filename="fallback.zip"; filename*=UTF-8''%E4%B8%AD%E6%96%87.zip
     */
    private String buildContentDisposition(String fileName) {
        String safeFileName = normalizeDownloadFileName(fileName);

        String asciiFallback = buildAsciiFallbackFileName(safeFileName);

        String encodedFileName = URLEncoder.encode(safeFileName, StandardCharsets.UTF_8)
                .replace("+", "%20");

        return "attachment; filename=\"" + asciiFallback + "\"; filename*=UTF-8''" + encodedFileName;
    }

    /**
     * 防止文件名为空、换行注入等问题。
     */
    private String normalizeDownloadFileName(String fileName) {
        if (!StringUtils.hasText(fileName)) {
            return "dicom-export.zip";
        }

        String normalized = fileName.trim()
                .replace("\r", "")
                .replace("\n", "");

        if (!StringUtils.hasText(normalized)) {
            return "dicom-export.zip";
        }

        if (!normalized.toLowerCase().endsWith(".zip")) {
            normalized = normalized + ".zip";
        }

        return normalized;
    }

    /**
     * filename= 只能尽量使用 ASCII，中文文件名靠 filename*=UTF-8''xxx 支持。
     *
     * 例如：
     * 中文病例.zip -> fallback.zip
     * test-001.zip -> test-001.zip
     */
    private String buildAsciiFallbackFileName(String fileName) {
        String fallback = fileName.replaceAll("[^a-zA-Z0-9._-]", "_");

        fallback = fallback.replaceAll("_+", "_");

        if (!StringUtils.hasText(fallback) || fallback.equals(".zip") || fallback.equals("_")) {
            fallback = "dicom-export.zip";
        }

        if (!fallback.toLowerCase().endsWith(".zip")) {
            fallback = fallback + ".zip";
        }

        return fallback;
    }

    private LoginUser getCurrentLoginUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof LoginUser loginUser)) {
            throw new BusinessException("未登录或登录状态已失效");
        }
        return loginUser;
    }
}