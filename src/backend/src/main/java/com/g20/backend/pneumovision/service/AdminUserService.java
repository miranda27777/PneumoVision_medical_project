package com.g20.backend.pneumovision.service;

import com.g20.backend.pneumovision.common.enums.AuditActionEnum;
import com.g20.backend.pneumovision.common.enums.RoleEnum;
import com.g20.backend.pneumovision.common.exception.BusinessException;
import com.g20.backend.pneumovision.dto.common.PageResponse;
import com.g20.backend.pneumovision.dto.user.UserCreateRequest;
import com.g20.backend.pneumovision.dto.user.UserResponse;
import com.g20.backend.pneumovision.entity.User;
import com.g20.backend.pneumovision.repository.UserRepository;
import com.g20.backend.pneumovision.security.LoginUser;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 系统管理员：创建/禁用/启用用户、查询用户列表
 */
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final UserRepository userRepository;
    private final AuditService auditService;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    private LoginUser currentAdmin() {
        return (LoginUser) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    @Transactional
    public UserResponse createUser(UserCreateRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BusinessException("用户名已存在");
        }
        RoleEnum role = request.getRole();
        if (role == null) {
            throw new BusinessException("角色不能为空");
        }
        User user = User.builder()
                .username(request.getUsername())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(role.getCode())
                .enabled(true)
                .build();
        user = userRepository.save(user);
        LoginUser admin = currentAdmin();
        auditService.log(AuditActionEnum.USER_CREATE, admin.getId(), admin.getUsername(),
                "用户: " + user.getUsername(), "角色: " + role.getDesc(), null);
        return UserResponse.fromEntity(user);
    }

    @Transactional
    public UserResponse disableUser(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new BusinessException("用户不存在"));
        if ("ADMIN".equals(user.getRole())) {
            throw new BusinessException("不能禁用管理员账号");
        }
        user.setEnabled(false);
        user = userRepository.save(user);
        LoginUser admin = currentAdmin();
        auditService.log(AuditActionEnum.USER_DISABLE, admin.getId(), admin.getUsername(),
                "用户: " + user.getUsername(), null, null);
        return UserResponse.fromEntity(user);
    }

    @Transactional
    public UserResponse enableUser(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new BusinessException("用户不存在"));
        user.setEnabled(true);
        user = userRepository.save(user);
        LoginUser admin = currentAdmin();
        auditService.log(AuditActionEnum.USER_ENABLE, admin.getId(), admin.getUsername(),
                "用户: " + user.getUsername(), null, null);
        return UserResponse.fromEntity(user);
    }

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> listUsers(String roleFilter, Boolean enabledFilter, int page, int size) {
        boolean hasRole = roleFilter != null && !roleFilter.isBlank();
        boolean hasEnabled = enabledFilter != null;

        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                clampSize(size)
        );

        Page<User> usersPage;

        if (hasRole && hasEnabled) {
            usersPage = userRepository.findByRoleAndEnabledOrderByCreatedAtDesc(
                    roleFilter.trim(),
                    enabledFilter,
                    pageable
            );
        } else if (hasRole) {
            usersPage = userRepository.findByRoleOrderByCreatedAtDesc(
                    roleFilter.trim(),
                    pageable
            );
        } else if (hasEnabled) {
            usersPage = userRepository.findByEnabledOrderByCreatedAtDesc(
                    enabledFilter,
                    pageable
            );
        } else {
            usersPage = userRepository.findAllByOrderByCreatedAtDesc(pageable);
        }

        Page<UserResponse> mapped = usersPage.map(UserResponse::fromEntity);
        return PageResponse.from(mapped);
    }

    private int clampSize(int size) {
        if (size <= 0) {
            return 10;
        }
        return Math.min(size, 100);
    }

    public UserResponse getById(Long id) {
        User user = userRepository.findById(id).orElseThrow(() -> new BusinessException("用户不存在"));
        return UserResponse.fromEntity(user);
    }
}
