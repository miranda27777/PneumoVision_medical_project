package com.g20.backend.pneumovision.repository;

import com.g20.backend.pneumovision.entity.Study;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;

public interface StudyRepository extends JpaRepository<Study, Long> {

    List<Study> findByPatientCaseIdOrderByStudyTimeDesc(Long patientCaseId);

    @Query("""
            select s
            from Study s
            where s.patientCaseId = :patientCaseId
              and (:fromTime is null or s.studyTime >= :fromTime)
              and (:toTime is null or s.studyTime <= :toTime)
            order by s.studyTime desc
            """)
    Page<Study> search(
            @Param("patientCaseId") Long patientCaseId,
            @Param("fromTime") LocalDateTime fromTime,
            @Param("toTime") LocalDateTime toTime,
            Pageable pageable
    );

}
