package com.g20.backend.pneumovision.dto.patientcase;

import com.g20.backend.pneumovision.entity.PatientCase;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 病例列表项，用于列表/分页接口的返回。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PatientCaseListItem {

    private Long id;

    /** 病例编号 */
    private String caseNumber;

    /** 脱敏后的患者编号 */
    private String patientIdMasked;

    /** 脱敏后的患者姓名 */
    private String patientNameMasked;

    /** 前端默认不展示敏感信息 */
    private Boolean sensitiveVisible;

    private String gender;

    private Integer age;

    /** 创建人用户 ID */
    private Long createdBy;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    /** 病例描述 / 备注 */
    private String remark;

    public static PatientCaseListItem fromEntity(PatientCase entity) {
        if (entity == null) {
            return null;
        }

        return PatientCaseListItem.builder()
                .id(entity.getId())
                .caseNumber(entity.getCaseNumber())
                .patientIdMasked(maskPatientId(entity.getPatientIdDeidentified()))
                .patientNameMasked(maskName(entity.getPatientName()))
                .sensitiveVisible(false)
                .gender(entity.getGender())
                .age(entity.getAge())
                .createdBy(entity.getCreatedBy())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .remark(entity.getRemark())
                .build();
    }

    private static String maskName(String name) {
        if (name == null || name.isBlank()) {
            return "";
        }
        if (name.length() == 1) {
            return "*";
        }
        return name.charAt(0) + "*".repeat(name.length() - 1);
    }

    private static String maskPatientId(String patientId) {
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
}