package com.g20.backend.pneumovision.dto.patientcase;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class PatientCaseCreateRequest {

    @NotBlank(message = "病例编号不能为空")
    @Size(max = 50, message = "病例编号最长 50 字符")
    private String caseNumber;

    @Size(max = 64, message = "患者脱敏 ID 最长 64 字符")
    private String patientIdDeidentified;

    @Size(max = 500, message = "备注最长 500 字符")
    private String remark;

    @NotBlank(message = "患者姓名不能为空")
    @Size(max = 100, message = "患者姓名最长 100 字符")
    private String patientName;

    @Pattern(regexp = "男|女", message = "性别只能为：男、女")
    private String gender;

    @Min(value = 0, message = "年龄不能小于0")
    @Max(value = 200, message = "年龄不能超过200")
    private Integer age;

}
