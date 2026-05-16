package com.g20.backend.pneumovision.common.enums;

import lombok.Getter;

/**
 * 医生评价状态
 */
@Getter
public enum DoctorEvaluationStatus {

    CORRECT("CORRECT", "正确"),
    ERROR("ERROR", "错误"),
    MISSED("MISSED", "漏检"),
    FALSE_POSITIVE("FALSE_POSITIVE", "误检");

    private final String code;
    private final String desc;

    DoctorEvaluationStatus(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public static DoctorEvaluationStatus fromCode(String code) {
        for (DoctorEvaluationStatus status : values()) {
            if (status.code.equals(code)) {
                return status;
            }
        }
        return null;
    }
}