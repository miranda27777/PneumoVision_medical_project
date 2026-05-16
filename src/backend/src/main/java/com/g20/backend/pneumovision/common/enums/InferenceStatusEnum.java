package com.g20.backend.pneumovision.common.enums;

import lombok.Getter;

/**
 * 推理任务状态：
 * PENDING -> QUEUED -> RUNNING -> (SUCCESS | FAILED)
 */
@Getter
public enum InferenceStatusEnum {

    PENDING,
    QUEUED,
    RUNNING,
    SUCCESS,
    FAILED
}

