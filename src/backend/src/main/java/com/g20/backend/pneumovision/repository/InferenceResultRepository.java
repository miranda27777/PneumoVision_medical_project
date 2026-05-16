package com.g20.backend.pneumovision.repository;

import com.g20.backend.pneumovision.entity.InferenceResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InferenceResultRepository extends JpaRepository<InferenceResult, Long> {

    /**
     * 根据任务 ID 查询该任务下的所有检测结果
     */
    List<InferenceResult> findByTaskId(Long taskId);

    void deleteByTaskId(Long taskId);
}
