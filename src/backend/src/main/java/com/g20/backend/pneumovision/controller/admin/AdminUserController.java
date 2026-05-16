package com.g20.backend.pneumovision.controller.admin;

import com.g20.backend.pneumovision.common.result.ApiResponse;
import com.g20.backend.pneumovision.dto.common.PageResponse;
import com.g20.backend.pneumovision.dto.user.UserCreateRequest;
import com.g20.backend.pneumovision.dto.user.UserResponse;
import com.g20.backend.pneumovision.service.AdminUserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 系统管理员 - 用户管理：创建/禁用/启用用户、查询用户列表
 */
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminUserService adminUserService;

    @PostMapping
    public ApiResponse<UserResponse> createUser(@Valid @RequestBody UserCreateRequest request) {
        UserResponse resp = adminUserService.createUser(request);
        return ApiResponse.success(resp);
    }

    @GetMapping
    public ApiResponse<PageResponse<UserResponse>> listUsers(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) Boolean enabled,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        PageResponse<UserResponse> pageResult = adminUserService.listUsers(role, enabled, page, size);
        return ApiResponse.success(pageResult);
    }

    @GetMapping("/{id}")
    public ApiResponse<UserResponse> getById(@PathVariable Long id) {
        return ApiResponse.success(adminUserService.getById(id));
    }

    @PostMapping("/{id}/disable")
    public ApiResponse<UserResponse> disableUser(@PathVariable Long id) {
        UserResponse resp = adminUserService.disableUser(id);
        return ApiResponse.success(resp);
    }

    @PostMapping("/{id}/enable")
    public ApiResponse<UserResponse> enableUser(@PathVariable Long id) {
        UserResponse resp = adminUserService.enableUser(id);
        return ApiResponse.success(resp);
    }
}
