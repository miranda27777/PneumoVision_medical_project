package com.g20.backend.pneumovision.service;

import com.g20.backend.pneumovision.common.exception.BusinessException;
import com.g20.backend.pneumovision.dto.patientcase.*;
import com.g20.backend.pneumovision.dto.common.PageResponse;
import com.g20.backend.pneumovision.entity.ImageAsset;
import com.g20.backend.pneumovision.entity.PatientCase;
import com.g20.backend.pneumovision.entity.InferenceResult;
import com.g20.backend.pneumovision.entity.InferenceTask;
import com.g20.backend.pneumovision.entity.Study;
import com.g20.backend.pneumovision.entity.User;
import com.g20.backend.pneumovision.repository.ImageAssetRepository;
import com.g20.backend.pneumovision.repository.InferenceResultRepository;
import com.g20.backend.pneumovision.repository.InferenceTaskRepository;
import com.g20.backend.pneumovision.repository.PatientCaseRepository;
import com.g20.backend.pneumovision.repository.StudyRepository;
import com.g20.backend.pneumovision.repository.UserRepository;
import com.g20.backend.pneumovision.security.LoginUser;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PatientCaseService {

    private final PatientCaseRepository patientCaseRepository;
    private final PatientCaseAccessService patientCaseAccessService;
    private final UserRepository userRepository;
    private final StudyRepository studyRepository;
    private final ImageAssetRepository imageAssetRepository;
    private final InferenceTaskRepository inferenceTaskRepository;
    private final InferenceResultRepository inferenceResultRepository;

    @Transactional
public PatientCaseDetailResponse create(PatientCaseCreateRequest request, LoginUser currentUser) {
    if (currentUser == null) {
        throw new BusinessException("未登录或登录状态已失效");
    }
    if (request == null || request.getCaseNumber() == null) {
        throw new BusinessException("病例编号不能为空");
    }
    if (patientCaseRepository.existsByCaseNumber(request.getCaseNumber())) {
        throw new BusinessException("病例编号已存在");
    }

        PatientCase entity = PatientCase.builder()
                .caseNumber(request.getCaseNumber())
                .patientIdDeidentified(request.getPatientIdDeidentified())
                .patientName(request.getPatientName())
                .gender(request.getGender())
                .age(request.getAge())
                .remark(request.getRemark())
                .createdBy(currentUser.getId())
                .build();

    PatientCase saved = patientCaseRepository.save(entity);

    return toDetailResponse(saved);
}

    @Transactional(readOnly = true)
    public PageResponse<PatientCaseListItem> list(
            String caseNumber,
            LocalDate from,
            LocalDate to,
            int page,
            int size,
            LoginUser currentUser
    ) {
        LocalDateTime fromTime = from == null ? null : from.atStartOfDay();
        LocalDateTime toTime = to == null ? null : to.atTime(LocalTime.MAX);

        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                clampSize(size)
        );

        Long createdByFilter = patientCaseAccessService.patientCaseOwnerIdFilterOrNull(currentUser);

        Page<PatientCase> result = patientCaseRepository.search(
                normalizeEmpty(caseNumber),
                fromTime,
                toTime,
                createdByFilter,
                pageable
        );

        Page<PatientCaseListItem> mapped = result.map(PatientCaseListItem::fromEntity);
        return PageResponse.from(mapped);
    }

    @Transactional(readOnly = true)
    public PatientCaseDetailResponse getById(Long id, LoginUser currentUser) {
        patientCaseAccessService.assertDoctorOwnsPatientCase(currentUser, id);
        PatientCase entity = patientCaseRepository.findById(id)
                .orElseThrow(() -> new BusinessException("病例不存在"));
        return toDetailResponse(entity);
    }

    // 返回明文
    @Transactional(readOnly = true)
    public PatientCaseSensitiveInfoResponse getSensitiveInfo(Long id, LoginUser currentUser) {
        patientCaseAccessService.assertCanViewSensitiveInfo(currentUser, id);

        PatientCase entity = patientCaseRepository.findById(id)
                .orElseThrow(() -> new BusinessException("病例不存在"));

        return PatientCaseSensitiveInfoResponse.builder()
                .patientName(entity.getPatientName())
                .patientIdDeidentified(entity.getPatientIdDeidentified())
                .build();
    }

    @Transactional
    public PatientCaseDetailResponse update(Long id, PatientCaseUpdateRequest request, LoginUser currentUser) {
        if (currentUser == null) {
            throw new BusinessException("未登录或登录状态已失效");
        }
        if (request == null) {
            throw new BusinessException("更新请求不能为空");
        }
        patientCaseAccessService.assertDoctorOwnsPatientCase(currentUser, id);

        PatientCase entity = patientCaseRepository.findById(id)
                .orElseThrow(() -> new BusinessException("病例不存在"));

        // 更新可选字段
        if (request.getPatientIdDeidentified() != null) {
            entity.setPatientIdDeidentified(request.getPatientIdDeidentified());
        }
        if (request.getRemark() != null) {
            entity.setRemark(request.getRemark());
        }
        if (request.getPatientName() != null) {
            entity.setPatientName(request.getPatientName());
        }
        if (request.getGender() != null) {
            entity.setGender(request.getGender());
        }
        if (request.getAge() != null) {
            entity.setAge(request.getAge());
        }

        // createdBy 不变：保持原创建人
        PatientCase saved = patientCaseRepository.save(entity);
        return toDetailResponse(saved);
    }

    @Transactional
    public void delete(Long id, LoginUser currentUser) {
        patientCaseAccessService.assertDoctorOwnsPatientCase(currentUser, id);
        if (!patientCaseRepository.existsById(id)) {
            throw new BusinessException("病例不存在");
        }

        // 级联删除顺序：
        // PatientCase -> Study -> ImageAsset -> InferenceTask -> InferenceResult
        List<Study> studies = studyRepository.findByPatientCaseIdOrderByStudyTimeDesc(id);
        for (Study study : studies) {
            Long studyId = study.getId();

            List<ImageAsset> imageAssets = imageAssetRepository.findByStudyIdOrderByCreatedAtDesc(studyId);
            for (ImageAsset imageAsset : imageAssets) {
                Long imageId = imageAsset.getId();

                // 先删推理结果，再删推理任务
                List<InferenceTask> tasks = inferenceTaskRepository.findByImageIdOrderByCreatedAtDesc(imageId);
                for (InferenceTask task : tasks) {
                    List<InferenceResult> results = inferenceResultRepository.findByTaskId(task.getId());
                    inferenceResultRepository.deleteAll(results);
                }
                inferenceTaskRepository.deleteAll(tasks);

                // 最后删影像文件（尽力而为）
                deleteFileIfExists(imageAsset.getFilePath());
            }

            // 再删影像记录
            imageAssetRepository.deleteAll(imageAssets);
        }

        // 再删检查记录
        studyRepository.deleteAll(studies);

        // 最后删病例记录
        patientCaseRepository.deleteById(id);
    }

    private PatientCaseDetailResponse toDetailResponse(PatientCase entity) {
        User creator = entity.getCreatedBy() == null
                ? null
                : userRepository.findById(entity.getCreatedBy()).orElse(null);

        return PatientCaseDetailResponse.builder()
                .id(entity.getId())
                .caseNumber(entity.getCaseNumber())
                .patientIdMasked(maskPatientId(entity.getPatientIdDeidentified()))
                .patientNameMasked(maskName(entity.getPatientName()))
                .sensitiveVisible(false)
                .gender(entity.getGender())
                .age(entity.getAge())
                .createdBy(entity.getCreatedBy())
                .createdByName(creator == null ? null : creator.getUsername())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .remark(entity.getRemark())
                .build();
    }

    private String maskName(String name) {
        if (name == null || name.isBlank()) {
            return "";
        }

        if (name.length() == 1) {
            return "*";
        }

        return name.charAt(0) + "*".repeat(name.length() - 1);
    }

    private String maskPatientId(String patientId) {
        if (patientId == null || patientId.isBlank()) {
            return "";
        }

        if (patientId.length() <= 4) {
            return "*".repeat(patientId.length());
        }

        String start = patientId.substring(0, 2);
        String end = patientId.substring(patientId.length() - 2);

        return start + "****" + end;
    }

    private String normalizeEmpty(String v) {
        if (v == null) return null;
        if (v.trim().isEmpty()) return null;
        return v.trim();
    }

    private int clampSize(int size) {
        if (size <= 0) return 10;
        return Math.min(size, 100);
    }

    private void deleteFileIfExists(String filePath) {
        if (filePath == null || filePath.isBlank()) {
            return;
        }
        try {
            Path path = Paths.get(filePath);
            if (Files.exists(path)) {
                Files.delete(path);
            }
        } catch (Exception ignore) {
            // 文件删除失败不阻断主数据一致性流程
        }
    }
}

