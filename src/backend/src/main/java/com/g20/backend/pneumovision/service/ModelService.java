package com.g20.backend.pneumovision.service;

import com.g20.backend.pneumovision.common.exception.BusinessException;
import com.g20.backend.pneumovision.dto.model.ModelInfo;
import com.g20.backend.pneumovision.dto.model.ModelParamsUpdateRequest;
import com.g20.backend.pneumovision.dto.model.PythonModelResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ModelService {

    private final RestTemplate restTemplate;

    @Value("${fastapi.base-url}")
    private String fastApiBaseUrl;

    /**
     * 查询模型列表
     * FastAPI 成功时必须返回 data
     */
    public Map<String, ModelInfo> listModels() {
        String url = fastApiBaseUrl + "/api/models";

        ResponseEntity<PythonModelResponse<Map<String, ModelInfo>>> responseEntity =
                restTemplate.exchange(
                        url,
                        HttpMethod.GET,
                        null,
                        new ParameterizedTypeReference<PythonModelResponse<Map<String, ModelInfo>>>() {}
                );

        PythonModelResponse<Map<String, ModelInfo>> response = responseEntity.getBody();
        if (response == null) {
            throw new BusinessException("FastAPI 返回为空");
        }
        if (response.getCode() == null || response.getCode() != 200) {
            throw new BusinessException(buildFastApiErrorMessage(response, "FastAPI 调用失败"));
        }
        if (response.getData() == null) {
            throw new BusinessException("FastAPI 返回 data 为空");
        }

        return response.getData();
    }

    /**
     * 更新模型参数
     * FastAPI 成功时 data 可以为空，因此只校验 code/message
     */
    public String updateModelParams(String modelId, ModelParamsUpdateRequest request) {
        if (request == null || request.isEmpty()) {
            throw new BusinessException("至少传一个要更新的参数");
        }

        String url = fastApiBaseUrl + "/api/models/" + modelId + "/params";

        Map<String, Object> body = new LinkedHashMap<>();
        if (request.getConf() != null) {
            body.put("conf", request.getConf());
        }
        if (request.getIou() != null) {
            body.put("iou", request.getIou());
        }
        if (request.getMaxDet() != null) {
            body.put("max_det", request.getMaxDet());
        }
        if (request.getTopK() != null) {
            body.put("top_k", request.getTopK());
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(body, headers);

        ResponseEntity<PythonModelResponse<Object>> responseEntity =
                restTemplate.exchange(
                        url,
                        HttpMethod.PUT,
                        requestEntity,
                        new ParameterizedTypeReference<PythonModelResponse<Object>>() {}
                );

        PythonModelResponse<Object> response = responseEntity.getBody();
        if (response == null) {
            throw new BusinessException("FastAPI 返回为空");
        }
        if (response.getCode() == null || response.getCode() != 200) {
            throw new BusinessException(buildFastApiErrorMessage(response, "参数更新失败"));
        }

        return response.getMessage() != null ? response.getMessage() : "参数更新成功";
    }

    /**
     * 启用模型
     * FastAPI 成功时 data 可以为空
     */
    public String enableModel(String modelId) {
        String url = fastApiBaseUrl + "/api/models/" + modelId + "/enable";
        return doPutWithoutBody(url, "启用模型成功");
    }

    /**
     * 禁用模型
     * FastAPI 成功时 data 可以为空
     */
    public String disableModel(String modelId) {
        String url = fastApiBaseUrl + "/api/models/" + modelId + "/disable";
        return doPutWithoutBody(url, "禁用模型成功");
    }

    private String doPutWithoutBody(String url, String defaultSuccessMessage) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

        ResponseEntity<PythonModelResponse<Object>> responseEntity =
                restTemplate.exchange(
                        url,
                        HttpMethod.PUT,
                        requestEntity,
                        new ParameterizedTypeReference<PythonModelResponse<Object>>() {}
                );

        PythonModelResponse<Object> response = responseEntity.getBody();
        if (response == null) {
            throw new BusinessException("FastAPI 返回为空");
        }
        if (response.getCode() == null || response.getCode() != 200) {
            throw new BusinessException(buildFastApiErrorMessage(response, "FastAPI 调用失败"));
        }

        return response.getMessage() != null ? response.getMessage() : defaultSuccessMessage;
    }

    private String buildFastApiErrorMessage(PythonModelResponse<?> response, String defaultMessage) {
        if (response == null) {
            return defaultMessage;
        }

        String message = response.getMessage();
        String error = response.getError();

        if (error != null && !error.isBlank()) {
            if (message != null && !message.isBlank()) {
                return message + ": " + error;
            }
            return error;
        }

        if (message != null && !message.isBlank()) {
            return message;
        }

        return defaultMessage;
    }
}