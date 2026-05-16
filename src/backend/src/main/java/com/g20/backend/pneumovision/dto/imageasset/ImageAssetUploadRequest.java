package com.g20.backend.pneumovision.dto.imageasset;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

@Data
public class ImageAssetUploadRequest {

    @NotNull(message = "检查 ID 不能为空")
    private Long studyId;

    @NotNull(message = "上传文件不能为空")
    private MultipartFile file;
}