package com.g20.backend.pneumovision.repository;

import com.g20.backend.pneumovision.common.enums.InferenceStatusEnum;
import com.g20.backend.pneumovision.entity.InferenceTask;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InferenceTaskRepository extends JpaRepository<InferenceTask, Long> {

    /**
     * 按影像 ID 查询任务，按创建时间倒序
     */
    List<InferenceTask> findByImageIdOrderByCreatedAtDesc(Long imageId);

    /**
     * 按检查 ID 查询任务，按创建时间倒序
     */
    List<InferenceTask> findByStudyIdOrderByCreatedAtDesc(Long studyId);

    /**
     * 按任务状态查询
     */
    List<InferenceTask> findByStatusOrderByCreatedAtDesc(InferenceStatusEnum status);

    /**
     * 按创建人查询
     */
    List<InferenceTask> findByCreatedByOrderByCreatedAtDesc(Long createdBy);
}
