package com.g20.backend.pneumovision.repository;

import com.g20.backend.pneumovision.entity.ImageAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;


public interface ImageAssetRepository extends JpaRepository<ImageAsset, Long> {

    /**
     * @param studyId 检查 ID
     * @return 影像列表
     */
    List<ImageAsset> findByStudyIdOrderByCreatedAtDesc(Long studyId);

    Page<ImageAsset> findByStudyId(Long studyId, Pageable pageable);

    /**
     * @param keyword 关键词，可为空
     * @param fileFormat 文件格式，可为空
     * @param studyId 检查 ID，可为空
     * @param uploadedBy 上传人 ID，可为空
     * @return 满足条件的影像列表，按创建时间倒序排列
     */
    @Query("""
            select ia
            from ImageAsset ia
            join Study s on ia.studyId = s.id
            join PatientCase pc on s.patientCaseId = pc.id
            where (:studyId is null or ia.studyId = :studyId)
              and (:uploadedBy is null or ia.uploadedBy = :uploadedBy)
              and (:fileFormat is null or lower(ia.fileFormat) = lower(:fileFormat))
              and (:fromTime is null or ia.createdAt >= :fromTime)
              and (:toTime is null or ia.createdAt <= :toTime)
              and (
                    :keyword is null or :keyword = '' or
                    lower(ia.fileName) like lower(concat('%', :keyword, '%')) or
                    lower(s.modality) like lower(concat('%', :keyword, '%')) or
                    lower(pc.caseNumber) like lower(concat('%', :keyword, '%')) or
                    lower(pc.patientIdDeidentified) like lower(concat('%', :keyword, '%'))
                  )
              and (:caseOwnerId is null or pc.createdBy = :caseOwnerId)
            order by ia.createdAt desc
            """)
    Page<ImageAsset> search(
            @Param("keyword") String keyword,
            @Param("fileFormat") String fileFormat,
            @Param("studyId") Long studyId,
            @Param("uploadedBy") Long uploadedBy,
            @Param("fromTime") LocalDateTime fromTime,
            @Param("toTime") LocalDateTime toTime,
            @Param("caseOwnerId") Long caseOwnerId,
            Pageable pageable
    );

    @Query("""
            select ia
            from ImageAsset ia
            join PatientCase pc on ia.patientCaseId = pc.id
            where pc.createdBy = :createdBy
            order by ia.createdAt desc
            """)
    Page<ImageAsset> findByPatientCaseCreatedBy(@Param("createdBy") Long createdBy, Pageable pageable);
}