package com.g20.backend.pneumovision.repository;

import com.g20.backend.pneumovision.entity.PatientCase;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.Optional;

public interface PatientCaseRepository extends JpaRepository<PatientCase, Long> {

    boolean existsByCaseNumber(String caseNumber);

    Optional<PatientCase> findByCaseNumber(String caseNumber);

    /**
     * 病例检索（用于列表页筛选）
     * - caseNumber：模糊匹配 （可空）
     * - patientName：模糊匹配（可空）
     * - fromTime / toTime：按 createdAt 时间范围过滤（可空）
     */
    @Query("""
        select pc
        from PatientCase pc
        where (:caseNumber is null or :caseNumber = '' or
               lower(pc.caseNumber) like lower(concat('%', :caseNumber, '%')))
          and (:fromTime is null or pc.createdAt >= :fromTime)
          and (:toTime is null or pc.createdAt <= :toTime)
          and (:createdBy is null or pc.createdBy = :createdBy)
        order by pc.updatedAt desc
        """)
    Page<PatientCase> search(
            @Param("caseNumber") String caseNumber,
            @Param("fromTime") LocalDateTime fromTime,
            @Param("toTime") LocalDateTime toTime,
            @Param("createdBy") Long createdBy,
            Pageable pageable
    );

}
