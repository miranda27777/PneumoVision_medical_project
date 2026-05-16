package com.g20.backend.pneumovision.dto.imageasset;

import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/** 批量上传请求的 multipart 表单字段。 */
@Data
@Schema(description = "批量上传影像")
public class ImageBatchUploadRequest {

    @NotNull(message = "检查 ID 不能为空")
    @Schema(description = "检查 ID", type = "integer", format = "int64")
    private Long studyId;

    @NotEmpty(message = "请选择至少一个文件")
    @ArraySchema(
            arraySchema = @Schema(description = "影像文件"),
            schema = @Schema(type = "string", format = "binary")
    )
    private List<MultipartFile> files;
}
