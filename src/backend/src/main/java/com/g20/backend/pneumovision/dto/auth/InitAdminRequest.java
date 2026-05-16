package com.g20.backend.pneumovision.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class InitAdminRequest {

    @NotBlank(message = "管理员用户名不能为空")
    @Size(min = 2, max = 50)
    private String username;

    @NotBlank(message = "管理员密码不能为空")
    @Size(min = 6, max = 32)
    private String password;

}

