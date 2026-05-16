package com.g20.backend.pneumovision.common.enums;

import lombok.Getter;

/**
 * 系统角色：系统管理员、超声科医生、科研人员
 */
@Getter
public enum RoleEnum {

    ADMIN("ADMIN", "系统管理员"),
    DOCTOR("DOCTOR", "超声科医生"),
    RESEARCHER("RESEARCHER", "科研人员");

    private final String code;
    private final String desc;

    RoleEnum(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public static RoleEnum fromCode(String code) {
        for (RoleEnum r : values()) {
            if (r.code.equals(code)) return r;
        }
        return null;
    }
}
