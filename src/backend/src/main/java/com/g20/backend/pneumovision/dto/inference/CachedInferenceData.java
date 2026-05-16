package com.g20.backend.pneumovision.dto.inference;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class CachedInferenceData {
    private String modelId;
    private String predLabel;
    private List<CachedInferenceItem> results = new ArrayList<>();
}