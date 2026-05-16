package com.g20.backend.pneumovision.common.enums;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum ModelIdEnum {
    PNEUMO_V1("pneumo_v1"),
    PNEUMO_V2("pneumo_v2");

    private final String value;

    ModelIdEnum(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static ModelIdEnum fromValue(String value) {
        for (ModelIdEnum model : ModelIdEnum.values()) {
            if (model.value.equalsIgnoreCase(value)) {
                return model;
            }
        }
        throw new IllegalArgumentException("不支持的模型类型: " + value);
    }
}
