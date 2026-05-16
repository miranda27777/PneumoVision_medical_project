package com.g20.backend.pneumovision.common.enums;

import lombok.Getter;

/**
 * 审计操作类型：登录、创建用户、禁用/启用用户、查看日志等
 */
@Getter
public enum AuditActionEnum {

    LOGIN("LOGIN", "登录"),
    LOGOUT("LOGOUT", "退出"),
    USER_CREATE("USER_CREATE", "创建用户"),
    USER_DISABLE("USER_DISABLE", "禁用用户"),
    USER_ENABLE("USER_ENABLE", "启用用户"),
    VIEW_AUDIT_LOG("VIEW_AUDIT_LOG", "查看审计日志"),

    IMAGE_UPLOAD("IMAGE_UPLOAD", "上传影像"),
    INFERENCE_REQUEST("INFERENCE_REQUEST", "发起推理任务"),
    INFERENCE_REVIEW("INFERENCE_REVIEW", "评价推理结果"),

    RESEARCHER_VIEW_IMAGE("RESEARCHER_VIEW_IMAGE", "科研人员查看影像"),
    RESEARCHER_VIEW_INFERENCE("RESEARCHER_VIEW_INFERENCE", "科研人员查看推理结果"),
    RESEARCHER_EXPORT_RESULT("RESEARCHER_EXPORT_RESULT", "科研人员导出结果"),
    RESEARCHER_MODEL_VIEW("RESEARCHER_MODEL_VIEW", "科研人员查看模型配置"),
    RESEARCHER_MODEL_UPDATE("RESEARCHER_MODEL_UPDATE", "科研人员更新模型参数"),
    RESEARCHER_MODEL_ENABLE("RESEARCHER_MODEL_ENABLE", "科研人员启用模型"),
    RESEARCHER_MODEL_DISABLE("RESEARCHER_MODEL_DISABLE", "科研人员禁用模型");

    private final String code;
    private final String desc;

    AuditActionEnum(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}
