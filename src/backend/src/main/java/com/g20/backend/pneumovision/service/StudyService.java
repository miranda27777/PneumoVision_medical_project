package com.g20.backend.pneumovision.service;

import com.g20.backend.pneumovision.common.exception.BusinessException;
import com.g20.backend.pneumovision.dto.common.PageResponse;
import com.g20.backend.pneumovision.dto.study.StudyCreateRequest;
import com.g20.backend.pneumovision.dto.study.StudyDetailResponse;
import com.g20.backend.pneumovision.dto.study.StudyListItem;
import com.g20.backend.pneumovision.dto.study.StudyUpdateRequest;
import com.g20.backend.pneumovision.entity.ImageAsset;
import com.g20.backend.pneumovision.entity.PatientCase;
import com.g20.backend.pneumovision.entity.InferenceResult;
import com.g20.backend.pneumovision.entity.InferenceTask;
import com.g20.backend.pneumovision.entity.Study;
import com.g20.backend.pneumovision.repository.ImageAssetRepository;
import com.g20.backend.pneumovision.repository.InferenceResultRepository;
import com.g20.backend.pneumovision.repository.InferenceTaskRepository;
import com.g20.backend.pneumovision.repository.PatientCaseRepository;
import com.g20.backend.pneumovision.repository.StudyRepository;
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
public class StudyService {

    private final StudyRepository studyRepository;
    private final PatientCaseAccessService patientCaseAccessService;
    private final PatientCaseRepository patientCaseRepository;
    private final ImageAssetRepository imageAssetRepository;
    private final InferenceTaskRepository inferenceTaskRepository;
    private final InferenceResultRepository inferenceResultRepository;

    @Transactional
    public StudyDetailResponse create(Long patientCaseId, StudyCreateRequest request, LoginUser currentUser) {
        if (currentUser == null) {
            throw new BusinessException("未登录或登录状态已失效");
        }
        if (request == null) {
            throw new BusinessException("创建请求不能为空");
        }

        PatientCase patientCase = patientCaseRepository.findById(patientCaseId)
                .orElseThrow(() -> new BusinessException("病例不存在"));
        patientCaseAccessService.assertDoctorOwnsPatientCase(currentUser, patientCase.getId());

        Study entity = Study.builder()
                .patientCaseId(patientCase.getId())
                .studyTime(request.getStudyTime())
                .modality(request.getModality())
                .description(request.getDescription())
                .build();

        Study saved = studyRepository.save(entity);
        return toDetailResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<StudyListItem> listByPatientCaseId(
            Long patientCaseId,
            LocalDate from,
            LocalDate to,
            int page,
            int size,
            LoginUser currentUser
    ) {
        if (!patientCaseRepository.existsById(patientCaseId)) {
            throw new BusinessException("病例不存在");
        }
        patientCaseAccessService.assertDoctorOwnsPatientCase(currentUser, patientCaseId);

        LocalDateTime fromTime = from == null ? null : from.atStartOfDay();
        LocalDateTime toTime = to == null ? null : to.atTime(LocalTime.MAX);

        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                clampSize(size)
        );

        Page<Study> result = studyRepository.search(patientCaseId, fromTime, toTime, pageable);
        Page<StudyListItem> mapped = result.map(StudyListItem::fromEntity);
        return PageResponse.from(mapped);
    }

    @Transactional(readOnly = true)
    public StudyDetailResponse getById(Long patientCaseId, Long studyId, LoginUser currentUser) {
        patientCaseAccessService.assertDoctorOwnsPatientCase(currentUser, patientCaseId);

        Study study = studyRepository.findById(studyId)
                .orElseThrow(() -> new BusinessException("检查记录不存在"));

        if (!study.getPatientCaseId().equals(patientCaseId)) {
            throw new BusinessException("该检查不属于该病例");
        }

        return toDetailResponse(study);
    }

    @Transactional
    public StudyDetailResponse update(Long patientCaseId, Long studyId, StudyUpdateRequest request, LoginUser currentUser) {
        if (currentUser == null) {
            throw new BusinessException("未登录或登录状态已失效");
        }
        if (request == null) {
            throw new BusinessException("更新请求不能为空");
        }

        patientCaseAccessService.assertDoctorOwnsPatientCase(currentUser, patientCaseId);

        Study study = studyRepository.findById(studyId)
                .orElseThrow(() -> new BusinessException("检查记录不存在"));

        if (!study.getPatientCaseId().equals(patientCaseId)) {
            throw new BusinessException("该检查不属于该病例");
        }

        if (request.getStudyTime() != null) {
            study.setStudyTime(request.getStudyTime());
        }
        if (request.getModality() != null) {
            study.setModality(request.getModality());
        }
        if (request.getDescription() != null) {
            study.setDescription(request.getDescription());
        }

        Study saved = studyRepository.save(study);
        return toDetailResponse(saved);
    }

    @Transactional
    public void delete(Long patientCaseId, Long studyId, LoginUser currentUser) {
        if (currentUser == null) {
            throw new BusinessException("未登录或登录状态已失效");
        }

        patientCaseAccessService.assertDoctorOwnsPatientCase(currentUser, patientCaseId);

        Study study = studyRepository.findById(studyId)
                .orElseThrow(() -> new BusinessException("检查记录不存在"));

        if (!study.getPatientCaseId().equals(patientCaseId)) {
            throw new BusinessException("该检查不属于该病例");
        }

        // 级联删除顺序：
        // ImageAsset -> InferenceTask -> InferenceResult
        List<ImageAsset> imageAssets = imageAssetRepository.findByStudyIdOrderByCreatedAtDesc(studyId);
        for (ImageAsset imageAsset : imageAssets) {
            Long imageId = imageAsset.getId();

            List<InferenceTask> tasks = inferenceTaskRepository.findByImageIdOrderByCreatedAtDesc(imageId);
            for (InferenceTask task : tasks) {
                List<InferenceResult> results = inferenceResultRepository.findByTaskId(task.getId());
                inferenceResultRepository.deleteAll(results);
            }
            inferenceTaskRepository.deleteAll(tasks);

            deleteFileIfExists(imageAsset.getFilePath());
        }

        imageAssetRepository.deleteAll(imageAssets);
        studyRepository.deleteById(studyId);
    }

    private StudyDetailResponse toDetailResponse(Study entity) {
        return StudyDetailResponse.fromEntity(entity);
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
            // 文件删除失败不影响主数据一致性
        }
    }

    private int clampSize(int size) {
        if (size <= 0) return 10;
        return Math.min(size, 100);
    }
}

