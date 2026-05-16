package com.g20.backend.pneumovision.dto.user;

import com.g20.backend.pneumovision.entity.User;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class UserResponse {

    private Long id;
    private String username;
    private String role;
    private Boolean enabled;
    private LocalDateTime createdAt;

    public static UserResponse fromEntity(User u) {
        return UserResponse.builder()
                .id(u.getId())
                .username(u.getUsername())
                .role(u.getRole())
                .enabled(u.getEnabled())
                .createdAt(u.getCreatedAt())
                .build();
    }
}
