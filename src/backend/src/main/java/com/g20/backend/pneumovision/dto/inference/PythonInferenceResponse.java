package com.g20.backend.pneumovision.dto.inference;

import lombok.Data;

import java.util.List;

@Data
public class PythonInferenceResponse {

    private Integer code;
    private String message;
    private String error;
    private DataBody data;

    @Data
    public static class DataBody {
        private Long imageId;
        private String modelId;
        private Integer predClass;
        private String predLabel;
        private List<ResultItem> results;
    }

    @Data
    public static class ResultItem {
        private String label;
        private Double score;
        private Double x;
        private Double y;
        private Double width;
        private Double height;
        private String maskPath;
    }
}