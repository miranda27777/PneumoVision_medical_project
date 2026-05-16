package com.g20.backend.pneumovision.service;

import com.g20.backend.pneumovision.common.exception.BusinessException;
import com.g20.backend.pneumovision.entity.ImageAsset;
import com.g20.backend.pneumovision.entity.PatientCase;
import com.g20.backend.pneumovision.entity.Study;
import com.g20.backend.pneumovision.repository.ImageAssetRepository;
import com.g20.backend.pneumovision.repository.PatientCaseRepository;
import com.g20.backend.pneumovision.repository.StudyRepository;
import com.g20.backend.pneumovision.security.LoginUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 医生维度病例隔离：仅 {@code DOCTOR} 仅能访问 {@link PatientCase#getCreatedBy()} 与本人一致的病例及其下属资源；
 * {@code ADMIN} 不做限制。其他角色按调用方 Security 规则，本服务中对非 DOCTOR 不额外校验。
 */
@Service
@RequiredArgsConstructor
public class PatientCaseAccessService {

    private static final String ROLE_DOCTOR = "DOCTOR";

    private final PatientCaseRepository patientCaseRepository;
    private final StudyRepository studyRepository;
    private final ImageAssetRepository imageAssetRepository;

    /**
     * 列表过滤：医生只看待创建人为自己的病例；管理员等返回 null 表示不按创建人过滤。
     */
    public Long patientCaseOwnerIdFilterOrNull(LoginUser user) {
        if (user == null) {
            return null;
        }
        if (user.isAdmin()) {
            return null;
        }
        if (ROLE_DOCTOR.equals(user.getRole())) {
            return user.getId();
        }
        return null;
    }

    public void assertDoctorOwnsPatientCase(LoginUser user, Long patientCaseId) {
        if (user == null) {
            throw new BusinessException("未登录或登录状态已失效");
        }
        if (user.isAdmin() || !ROLE_DOCTOR.equals(user.getRole())) {
            return;
        }
        PatientCase pc = patientCaseRepository.findById(patientCaseId)
                .orElseThrow(() -> new BusinessException("病例不存在"));
        if (!user.getId().equals(pc.getCreatedBy())) {
            throw new BusinessException("病例不存在");
        }
    }

    public void assertDoctorOwnsStudy(LoginUser user, Long studyId) {
        if (user == null) {
            throw new BusinessException("未登录或登录状态已失效");
        }
        if (user.isAdmin() || !ROLE_DOCTOR.equals(user.getRole())) {
            return;
        }
        Study study = studyRepository.findById(studyId)
                .orElseThrow(() -> new BusinessException("检查记录不存在"));
        assertDoctorOwnsPatientCase(user, study.getPatientCaseId());
    }

    public void assertDoctorOwnsImage(LoginUser user, Long imageId) {
        if (user == null) {
            throw new BusinessException("未登录或登录状态已失效");
        }
        if (user.isAdmin() || !ROLE_DOCTOR.equals(user.getRole())) {
            return;
        }
        ImageAsset image = imageAssetRepository.findById(imageId)
                .orElseThrow(() -> new BusinessException("影像不存在"));
        assertDoctorOwnsStudy(user, image.getStudyId());
    }

    public void assertCanViewSensitiveInfo(LoginUser user, Long patientCaseId) {
        if (user == null) {
            throw new BusinessException("未登录或登录状态已失效");
        }

        // 只有医生可以查看患者敏感信息
        if (ROLE_DOCTOR.equals(user.getRole())) {
            assertDoctorOwnsPatientCase(user, patientCaseId);
            return;
        }

        throw new BusinessException("无权查看患者敏感信息");
    }
}
