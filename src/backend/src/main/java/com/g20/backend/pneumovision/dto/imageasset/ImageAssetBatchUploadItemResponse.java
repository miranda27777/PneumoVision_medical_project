package com.g20.backend.pneumovision.dto.imageasset;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** 批量上传单条结果。 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ImageAssetBatchUploadItemResponse {

    private String fileName;

    /** 成功时有值 */
    private ImageAssetDetailResponse image;

    /** 失败时有值 */
    private String error;
}
