package com.g20.backend.pneumovision.dto.user;

import com.g20.backend.pneumovision.common.enums.RoleEnum;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UserCreateRequest {

    @NotBlank(message = "用户名不能为空")
    @Size(min = 2, max = 50)
    private String username;

    @NotBlank(message = "密码不能为空")
    @Size(min = 6, max = 32)
    private String password;

    @NotNull(message = "角色不能为空")
    private RoleEnum role;  // DOCTOR / RESEARCHER（管理员创建时一般不再建 ADMIN）
}
