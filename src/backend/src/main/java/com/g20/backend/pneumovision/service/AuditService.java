package com.g20.backend.pneumovision.service;

import com.g20.backend.pneumovision.common.enums.AuditActionEnum;
import com.g20.backend.pneumovision.dto.audit.AuditLogQueryRequest;
import com.g20.backend.pneumovision.entity.AuditLog;
import com.g20.backend.pneumovision.repository.AuditLogRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    public void log(AuditActionEnum action, Long operatorId, String operatorUsername,
                    String target, String detail, String ipAddress) {
        AuditLog log = AuditLog.builder()
                .action(action.getCode())
                .operatorId(operatorId)
                .operatorUsername(operatorUsername)
                .target(target)
                .detail(detail)
                .ipAddress(ipAddress)
                .build();
        auditLogRepository.save(log);
    }

    public Page<AuditLog> searchLogs(AuditLogQueryRequest queryRequest, Pageable pageable) {
        Specification<AuditLog> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (queryRequest.getUsername() != null && !queryRequest.getUsername().isBlank()) {
                predicates.add(cb.like(
                        cb.lower(root.get("operatorUsername")),
                        "%" + queryRequest.getUsername().trim().toLowerCase() + "%"
                ));
            }

            if (queryRequest.getDate() != null) {
                LocalDateTime dayStart = queryRequest.getDate().atStartOfDay();
                LocalDateTime dayEnd = queryRequest.getDate().plusDays(1).atStartOfDay();
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), dayStart));
                predicates.add(cb.lessThan(root.get("createdAt"), dayEnd));
            }

            if (queryRequest.getStartTime() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), queryRequest.getStartTime()));
            }

            if (queryRequest.getEndTime() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), queryRequest.getEndTime()));
            }

            query.orderBy(cb.desc(root.get("createdAt")));
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return auditLogRepository.findAll(spec, pageable);
    }
}
