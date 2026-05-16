package com.g20.backend.pneumovision.dto.patientcase;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class PatientCaseUpdateRequest {

    @Size(max = 64, message = "患者脱敏 ID 最长 64 字符")
    private String patientIdDeidentified;

    @Size(max = 500, message = "备注最长 500 字符")
    private String remark;

    @Size(max = 100, message = "患者姓名最长 100 字符")
    private String patientName;

    @Pattern(regexp = "男|女", message = "性别只能为：男、女")
    private String gender;

    @Min(value = 0, message = "年龄不能小于0")
    @Max(value = 200, message = "年龄不能超过200")
    private Integer age;
}
