package com.g20.backend.pneumovision.service;

import com.g20.backend.pneumovision.common.enums.AuditActionEnum;
import com.g20.backend.pneumovision.common.exception.BusinessException;
import com.g20.backend.pneumovision.dto.common.PageResponse;
import com.g20.backend.pneumovision.dto.imageasset.ImageAssetBatchUploadItemResponse;
import com.g20.backend.pneumovision.dto.imageasset.ImageAssetDetailResponse;
import com.g20.backend.pneumovision.dto.imageasset.ImageAssetListItem;
import com.g20.backend.pneumovision.dto.imageasset.ImageAssetSearchRequest;
import com.g20.backend.pneumovision.dto.imageasset.ImageAssetUploadRequest;
import com.g20.backend.pneumovision.entity.ImageAsset;
import com.g20.backend.pneumovision.entity.InferenceResult;
import com.g20.backend.pneumovision.entity.InferenceTask;
import com.g20.backend.pneumovision.entity.PatientCase;
import com.g20.backend.pneumovision.entity.Study;
import com.g20.backend.pneumovision.repository.ImageAssetRepository;
import com.g20.backend.pneumovision.repository.InferenceResultRepository;
import com.g20.backend.pneumovision.repository.InferenceTaskRepository;
import com.g20.backend.pneumovision.repository.PatientCaseRepository;
import com.g20.backend.pneumovision.repository.StudyRepository;
import com.g20.backend.pneumovision.security.LoginUser;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ImageAssetService {

    private final ImageAssetRepository imageAssetRepository;
    private final StudyRepository studyRepository;
    private final PatientCaseRepository patientCaseRepository;
    private final InferenceTaskRepository inferenceTaskRepository;
    private final InferenceResultRepository inferenceResultRepository;
    private final PatientCaseAccessService patientCaseAccessService;
    private final AuditService auditService;

    @Value("${file.upload-dir:uploads/images}")
    private String uploadDir;

    /**
     * 允许的文件扩展名（小写，不带点）
     */
    private static final List<String> ALLOWED_EXTENSIONS = List.of("png", "jpg", "jpeg", "dcm");

    private static final int MAX_BATCH_FILES = 50;

    /**
     * 单个文件最大大小（字节）。默认 50MB，可通过配置覆盖。
     */
    @Value("${file.max-size-bytes:52428800}")
    private long maxFileSizeBytes;

    /**
     * 科研人员浏览所有影像，并支持筛选：
     * 1. 图片 ID
     * 2. 上传时间范围
     * 3. AI 检测结果 normal / pneumonia
     * 4. 医生评价状态 CORRECT / ERROR / MISSED / FALSE_POSITIVE / UNREVIEWED
     */
    public PageResponse<ImageAssetListItem> listAll(
            ImageAssetSearchRequest request,
            int page,
            int size,
            LoginUser currentUser
    ) {
        if (request == null) {
            request = new ImageAssetSearchRequest();
        }

        LocalDateTime fromTime = request.getFromTime() == null
                ? null
                : request.getFromTime().atStartOfDay();

        LocalDateTime toTime = request.getToTime() == null
                ? null
                : request.getToTime().atTime(LocalTime.MAX);

        Long caseOwnerId = patientCaseAccessService.patientCaseOwnerIdFilterOrNull(currentUser);

        /*
         * 这里先查出满足“图片表条件”的影像：
         * keyword / fileFormat / studyId / uploadedBy / fromTime / toTime / 权限过滤
         *
         * 然后再补充最新任务信息，并按 resultLabel / doctorEvaluationStatus 过滤。
         * 因为 resultLabel 和 doctorEvaluationStatus 不在 ImageAsset 表里。
         */
        Page<ImageAsset> rawResult = imageAssetRepository.search(
                trimToNull(request.getKeyword()),
                trimToNull(request.getFileFormat()),
                request.getStudyId(),
                request.getUploadedBy(),
                fromTime,
                toTime,
                caseOwnerId,
                PageRequest.of(0, Integer.MAX_VALUE)
        );

        Long imageId = request.getImageId();
        String resultLabel = trimToNull(request.getResultLabel());
        String doctorEvaluationStatus = trimToNull(request.getDoctorEvaluationStatus());

        List<ImageAssetListItem> filtered = rawResult.getContent()
                .stream()
                .filter(image -> imageId == null || image.getId().equals(imageId))
                .map(this::toListItemWithTaskMeta)
                .filter(item -> matchResultLabel(item, resultLabel))
                .filter(item -> matchDoctorEvaluationStatus(item, doctorEvaluationStatus))
                .collect(Collectors.toList());

        Pageable pageable = PageRequest.of(Math.max(page, 0), clampSize(size));

        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), filtered.size());

        List<ImageAssetListItem> pageContent = start >= filtered.size()
                ? List.of()
                : filtered.subList(start, end);

        Page<ImageAssetListItem> pageResult = new PageImpl<>(pageContent, pageable, filtered.size());

        return PageResponse.from(pageResult);
    }

    /**
     * 根据检查 ID 查询该检查下的所有影像，并支持影像查找筛选。
     *
     * 支持：
     * 1. 图片 ID
     * 2. 图片上传时间范围 ImageAsset.createdAt
     * 3. AI 检测结果 resultLabel
     * 4. 医生评价状态 doctorEvaluationStatus
     */
    public PageResponse<ImageAssetListItem> listByStudyId(
            Long studyId,
            ImageAssetSearchRequest request,
            int page,
            int size,
            LoginUser currentUser
    ) {
        patientCaseAccessService.assertDoctorOwnsStudy(currentUser, studyId);

        if (request == null) {
            request = new ImageAssetSearchRequest();
        }

        LocalDateTime fromTime = request.getFromTime() == null
                ? null
                : request.getFromTime().atStartOfDay();

        LocalDateTime toTime = request.getToTime() == null
                ? null
                : request.getToTime().atTime(LocalTime.MAX);

        Long imageId = request.getImageId();
        String resultLabel = trimToNull(request.getResultLabel());
        String doctorEvaluationStatus = trimToNull(request.getDoctorEvaluationStatus());

        List<ImageAssetListItem> filtered = imageAssetRepository
                .findByStudyIdOrderByCreatedAtDesc(studyId)
                .stream()
                .filter(image -> imageId == null || image.getId().equals(imageId))
                .filter(image -> fromTime == null || !image.getCreatedAt().isBefore(fromTime))
                .filter(image -> toTime == null || !image.getCreatedAt().isAfter(toTime))
                .map(this::toListItemWithTaskMeta)
                .filter(item -> matchResultLabel(item, resultLabel))
                .filter(item -> matchDoctorEvaluationStatus(item, doctorEvaluationStatus))
                .collect(Collectors.toList());

        Pageable pageable = PageRequest.of(Math.max(page, 0), clampSize(size));

        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), filtered.size());

        List<ImageAssetListItem> pageContent = start >= filtered.size()
                ? List.of()
                : filtered.subList(start, end);

        Page<ImageAssetListItem> pageResult = new PageImpl<>(pageContent, pageable, filtered.size());

        return PageResponse.from(pageResult);
    }

    /**
     * 按条件检索影像。
     * 支持按关键词、文件格式、检查 ID、上传人 ID 组合筛选。
     */
    public PageResponse<ImageAssetListItem> search(ImageAssetSearchRequest request, int page, int size, LoginUser currentUser) {
        if (request == null) {
            request = new ImageAssetSearchRequest();
        }

        LocalDateTime fromTime = request.getFromTime() == null ? null : request.getFromTime().atStartOfDay();
        LocalDateTime toTime = request.getToTime() == null ? null : request.getToTime().atTime(LocalTime.MAX);

        Pageable pageable = PageRequest.of(Math.max(page, 0), clampSize(size));
        Long caseOwnerId = patientCaseAccessService.patientCaseOwnerIdFilterOrNull(currentUser);

        Page<ImageAsset> result = imageAssetRepository.search(
                trimToNull(request.getKeyword()),
                trimToNull(request.getFileFormat()),
                request.getStudyId(),
                request.getUploadedBy(),
                fromTime,
                toTime,
                caseOwnerId,
                pageable
        );

        Page<ImageAssetListItem> mapped = result.map(this::toListItemWithTaskMeta);
        return PageResponse.from(mapped);
    }

    private int clampSize(int size) {
        if (size <= 0) return 10;
        return Math.min(size, 100);
    }

    /**
     * 根据影像 ID 查询影像详情。
     */
    public ImageAssetDetailResponse getById(Long id, LoginUser currentUser) {
        patientCaseAccessService.assertDoctorOwnsImage(currentUser, id);
        ImageAsset imageAsset = imageAssetRepository.findById(id)
                .orElseThrow(() -> new BusinessException("影像不存在"));
        return toDetailResponse(imageAsset);
    }

    /**
     * 上传影像文件，并保存影像元数据到数据库。
     */
    public ImageAssetDetailResponse upload(ImageAssetUploadRequest request, LoginUser loginUser) {
        if (loginUser == null) {
            throw new BusinessException("未登录或登录状态已失效");
        }

        if (request.getFile() == null || request.getFile().isEmpty()) {
            throw new BusinessException("上传文件不能为空");
        }

        if (request.getFile().getSize() > maxFileSizeBytes) {
            throw new BusinessException("上传文件过大，单个文件最大支持 " + (maxFileSizeBytes / (1024 * 1024)) + "MB");
        }

        String originalFilename = request.getFile().getOriginalFilename();
        String cleanFileName = (originalFilename == null)
                ? "unknown"
                : Paths.get(originalFilename).getFileName().toString();

        String extension = "";
        int index = cleanFileName.lastIndexOf(".");
        if (index >= 0 && index < cleanFileName.length() - 1) {
            extension = cleanFileName.substring(index + 1).toLowerCase();
        }

        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new BusinessException("不支持的文件类型，仅支持: " + String.join(", ", ALLOWED_EXTENSIONS));
        }

        Study study = studyRepository.findById(request.getStudyId())
                .orElseThrow(() -> new BusinessException("检查记录不存在"));
        patientCaseAccessService.assertDoctorOwnsStudy(loginUser, study.getId());

        try {
            return uploadOneFile(request.getFile(), study, loginUser);
        } catch (IOException e) {
            throw new BusinessException("影像上传失败: " + e.getMessage());
        }
    }

    /**
     * 同一检查下批量上传；单张失败不影响其余。
     */
    public List<ImageAssetBatchUploadItemResponse> uploadBatch(MultipartFile[] files, Long studyId, LoginUser loginUser) {
        if (loginUser == null) {
            throw new BusinessException("未登录或登录状态已失效");
        }

        if (files == null || files.length == 0) {
            throw new BusinessException("请选择至少一个文件");
        }

        if (files.length > MAX_BATCH_FILES) {
            throw new BusinessException("单次最多上传 " + MAX_BATCH_FILES + " 个文件");
        }

        Study study = studyRepository.findById(studyId)
                .orElseThrow(() -> new BusinessException("检查记录不存在"));
        patientCaseAccessService.assertDoctorOwnsStudy(loginUser, study.getId());

        List<ImageAssetBatchUploadItemResponse> items = new ArrayList<>();

        for (MultipartFile file : files) {
            String name = file != null && file.getOriginalFilename() != null
                    ? Paths.get(file.getOriginalFilename()).getFileName().toString()
                    : "unknown";

            if (file == null || file.isEmpty()) {
                items.add(ImageAssetBatchUploadItemResponse.builder()
                        .fileName(name)
                        .image(null)
                        .error("文件为空")
                        .build());
                continue;
            }

            try {
                ImageAssetDetailResponse detail = uploadOneFile(file, study, loginUser);
                items.add(ImageAssetBatchUploadItemResponse.builder()
                        .fileName(name)
                        .image(detail)
                        .error(null)
                        .build());
            } catch (BusinessException e) {
                items.add(ImageAssetBatchUploadItemResponse.builder()
                        .fileName(name)
                        .image(null)
                        .error(e.getMessage())
                        .build());
            } catch (IOException e) {
                items.add(ImageAssetBatchUploadItemResponse.builder()
                        .fileName(name)
                        .image(null)
                        .error("影像上传失败: " + e.getMessage())
                        .build());
            }
        }

        return items;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteById(Long id, LoginUser currentUser) {
        if (currentUser == null) {
            throw new BusinessException("未登录或登录状态已失效");
        }

        patientCaseAccessService.assertDoctorOwnsImage(currentUser, id);

        ImageAsset imageAsset = imageAssetRepository.findById(id)
                .orElseThrow(() -> new BusinessException("影像不存在"));

        String filePath = imageAsset.getFilePath();

        if (StringUtils.hasText(filePath)) {
            try {
                Files.deleteIfExists(Paths.get(filePath));
            } catch (IOException e) {
                throw new BusinessException("删除影像文件失败: " + e.getMessage());
            }
        }

        imageAssetRepository.delete(imageAsset);
    }

    private ImageAssetDetailResponse uploadOneFile(MultipartFile multipart, Study study, LoginUser loginUser)
            throws IOException {
        Long currentUserId = loginUser.getId();
        String currentUsername = loginUser.getUsername();

        if (multipart.getSize() > maxFileSizeBytes) {
            throw new BusinessException("上传文件过大，单个文件最大支持 " + (maxFileSizeBytes / (1024 * 1024)) + "MB");
        }

        String originalFilename = multipart.getOriginalFilename();
        String cleanFileName = (originalFilename == null)
                ? "unknown"
                : Paths.get(originalFilename).getFileName().toString();

        String extension = "";
        int index = cleanFileName.lastIndexOf(".");
        if (index >= 0 && index < cleanFileName.length() - 1) {
            extension = cleanFileName.substring(index + 1).toLowerCase();
        }

        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new BusinessException("不支持的文件类型，仅支持: " + String.join(", ", ALLOWED_EXTENSIONS));
        }

        Path dir = Paths.get(uploadDir);
        if (!Files.exists(dir)) {
            Files.createDirectories(dir);
        }

        String storedFileName = UUID.randomUUID() + "_" + cleanFileName;
        Path targetPath = dir.resolve(storedFileName);

        Files.copy(multipart.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

        ImageAsset entity = ImageAsset.builder()
                .studyId(study.getId())
                .patientCaseId(study.getPatientCaseId())
                .fileName(cleanFileName)
                .filePath(targetPath.toString())
                .fileFormat(extension)
                .fileSize(multipart.getSize())
                .uploadedBy(currentUserId)
                .build();

        ImageAsset saved = imageAssetRepository.save(entity);

        String target = "image:" + saved.getId();
        String detail = "上传影像文件: " + cleanFileName + " (studyId=" + study.getId() + ")";
        auditService.log(AuditActionEnum.IMAGE_UPLOAD, currentUserId, currentUsername, target, detail, null);

        return toDetailResponse(saved);
    }

    /**
     * 将 ImageAsset 实体转换为列表项 DTO。
     */
    private ImageAssetListItem toListItem(ImageAsset entity) {
        Study study = studyRepository.findById(entity.getStudyId())
                .orElseThrow(() -> new BusinessException("关联检查记录不存在"));

        PatientCase patientCase = patientCaseRepository.findById(study.getPatientCaseId())
                .orElseThrow(() -> new BusinessException("关联病例不存在"));

        return ImageAssetListItem.builder()
                .id(entity.getId())
                .studyId(entity.getStudyId())
                .patientCaseId(patientCase.getId())
                .caseNumber(patientCase.getCaseNumber())
                .patientIdDeidentified(patientCase.getPatientIdDeidentified())
                .studyTime(study.getStudyTime())
                .modality(study.getModality())
                .fileName(entity.getFileName())
                .filePath(entity.getFilePath())
                .fileFormat(entity.getFileFormat())
                .fileSize(entity.getFileSize())
                .uploadedBy(entity.getUploadedBy())
                .createdAt(entity.getCreatedAt())
                .build();
    }

    /**
     * 列表项额外补充：
     * 1. 最新检测任务 ID
     * 2. 最新检测任务状态
     * 3. 医生评价状态
     * 4. 最新检测结果 label
     */
    private ImageAssetListItem toListItemWithTaskMeta(ImageAsset entity) {
        ImageAssetListItem item = toListItem(entity);

        InferenceTask latestTask = inferenceTaskRepository
                .findByImageIdOrderByCreatedAtDesc(entity.getId())
                .stream()
                .findFirst()
                .orElse(null);

        if (latestTask == null) {
            item.setTaskId(null);
            item.setTaskStatus(null);
            item.setDoctorEvaluationStatus(null);
            item.setResultLabel(null);
            return item;
        }

        item.setTaskId(latestTask.getId());
        item.setTaskStatus(enumToString(latestTask.getStatus()));
        item.setDoctorEvaluationStatus(enumToString(latestTask.getDoctorEvaluationStatus()));
        item.setResultLabel(findFirstResultLabel(latestTask.getId()));

        return item;
    }

    private String findFirstResultLabel(Long taskId) {
        if (taskId == null) {
            return null;
        }

        return inferenceResultRepository.findByTaskId(taskId)
                .stream()
                .map(InferenceResult::getLabel)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse(null);
    }

    private boolean matchResultLabel(ImageAssetListItem item, String resultLabel) {
        if (!StringUtils.hasText(resultLabel)) {
            return true;
        }

        return item.getResultLabel() != null
                && item.getResultLabel().equalsIgnoreCase(resultLabel);
    }

    private boolean matchDoctorEvaluationStatus(ImageAssetListItem item, String doctorEvaluationStatus) {
        if (!StringUtils.hasText(doctorEvaluationStatus)) {
            return true;
        }

        if ("UNREVIEWED".equalsIgnoreCase(doctorEvaluationStatus)) {
            return !StringUtils.hasText(item.getDoctorEvaluationStatus());
        }

        return item.getDoctorEvaluationStatus() != null
                && item.getDoctorEvaluationStatus().equalsIgnoreCase(doctorEvaluationStatus);
    }

    private String enumToString(Object value) {
        if (value == null) {
            return null;
        }
        return String.valueOf(value);
    }

    /**
     * 将 ImageAsset 实体转换为详情 DTO。
     */
    private ImageAssetDetailResponse toDetailResponse(ImageAsset entity) {
        Study study = studyRepository.findById(entity.getStudyId())
                .orElseThrow(() -> new BusinessException("关联检查记录不存在"));

        PatientCase patientCase = patientCaseRepository.findById(study.getPatientCaseId())
                .orElseThrow(() -> new BusinessException("关联病例不存在"));

        return ImageAssetDetailResponse.builder()
                .id(entity.getId())
                .studyId(entity.getStudyId())
                .patientCaseId(patientCase.getId())
                .caseNumber(patientCase.getCaseNumber())
                .patientIdDeidentified(patientCase.getPatientIdDeidentified())
                .studyTime(study.getStudyTime())
                .modality(study.getModality())
                .studyDescription(study.getDescription())
                .fileName(entity.getFileName())
                .filePath(entity.getFilePath())
                .fileFormat(entity.getFileFormat())
                .fileSize(entity.getFileSize())
                .uploadedBy(entity.getUploadedBy())
                .createdAt(entity.getCreatedAt())
                .build();
    }

    /**
     * 将字符串去除首尾空格；
     * 如果为空字符串或全是空白，则返回 null。
     */
    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }
}