package com.g20.backend.pneumovision.repository;

import com.g20.backend.pneumovision.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    boolean existsByUsername(String username);

    Page<User> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<User> findByRoleOrderByCreatedAtDesc(String role, Pageable pageable);

    Page<User> findByEnabledOrderByCreatedAtDesc(Boolean enabled, Pageable pageable);

    Page<User> findByRoleAndEnabledOrderByCreatedAtDesc(String role, Boolean enabled, Pageable pageable);
}