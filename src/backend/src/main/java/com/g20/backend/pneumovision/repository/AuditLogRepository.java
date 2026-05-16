package com.g20.backend.pneumovision.repository;

import com.g20.backend.pneumovision.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.LocalDateTime;
import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long>, JpaSpecificationExecutor<AuditLog> {

//    Page<AuditLog> findByOrderByCreatedAtDesc(Pageable pageable);
//
//    Page<AuditLog> findByActionOrderByCreatedAtDesc(String action, Pageable pageable);
//
//    Page<AuditLog> findByOperatorIdOrderByCreatedAtDesc(Long operatorId, Pageable pageable);
//
//    List<AuditLog> findByCreatedAtBetweenOrderByCreatedAtDesc(LocalDateTime start, LocalDateTime end);
}
