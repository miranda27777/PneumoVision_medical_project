package com.g20.backend.pneumovision.dto.imageasset;

import lombok.Data;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;

@Data
public class ImageAssetSearchRequest {

    /**
     * 关键词：支持文件名 / 病例编号 / 脱敏患者ID / 模态
     */
    private String keyword;

    /**
     * 文件格式，如 png/jpg/jpeg/dcm
     */
    private String fileFormat;

    /**
     * 检查 ID
     */
    private Long studyId;

    /**
     * 图片 ID
     */
    private Long imageId;

    /**
     * 上传人 ID
     */
    private Long uploadedBy;

    /**
     * 入库时间范围（按 ImageAsset.createdAt）
     */
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate fromTime;

    /**
     * 入库时间范围（按 ImageAsset.createdAt）
     */
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate toTime;

    /**
     * AI 检测结果：normal / pneumonia
     */
    private String resultLabel;

    /**
     * 医生评价状态：
     * CORRECT / ERROR / MISSED / FALSE_POSITIVE / UNREVIEWED
     */
    private String doctorEvaluationStatus;
}