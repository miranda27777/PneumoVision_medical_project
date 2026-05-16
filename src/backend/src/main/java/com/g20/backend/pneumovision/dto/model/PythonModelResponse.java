package com.g20.backend.pneumovision.dto.model;

import lombok.Data;

@Data
public class PythonModelResponse<T> {

    private Integer code;
    private String message;
    private String error;
    private T data;
}
