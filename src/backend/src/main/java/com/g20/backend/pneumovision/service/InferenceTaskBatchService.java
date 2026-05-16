package com.g20.backend.pneumovision.service;

import com.g20.backend.pneumovision.common.exception.BusinessException;
import com.g20.backend.pneumovision.dto.inference.InferenceBatchCreateRequest;
import com.g20.backend.pneumovision.dto.inference.InferenceBatchItemResponse;
import com.g20.backend.pneumovision.dto.inference.InferenceTaskCreateRequest;
import com.g20.backend.pneumovision.dto.inference.InferenceTaskResponse;
import com.g20.backend.pneumovision.security.LoginUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/** 按影像 ID 列表逐张创建推理任务。 */
@Service
@RequiredArgsConstructor
public class InferenceTaskBatchService {

    private final InferenceTaskService inferenceTaskService;

    public List<InferenceBatchItemResponse> createTasks(InferenceBatchCreateRequest request, LoginUser currentUser) {
        if (currentUser == null) {
            throw new BusinessException("未登录或登录状态已失效");
        }
        List<InferenceBatchItemResponse> out = new ArrayList<>();
        for (Long imageId : request.getImageIds()) {
            try {
                InferenceTaskCreateRequest single = new InferenceTaskCreateRequest();
                single.setImageId(imageId);
                single.setModelId(request.getModelId());
                InferenceTaskResponse task = inferenceTaskService.createTask(single, currentUser);
                out.add(InferenceBatchItemResponse.builder()
                        .imageId(imageId)
                        .task(task)
                        .error(null)
                        .build());
            } catch (BusinessException e) {
                out.add(InferenceBatchItemResponse.builder()
                        .imageId(imageId)
                        .task(null)
                        .error(e.getMessage())
                        .build());
            }
        }
        return out;
    }
}
