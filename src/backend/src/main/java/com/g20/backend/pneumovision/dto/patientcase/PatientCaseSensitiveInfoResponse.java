package com.g20.backend.pneumovision.dto.patientcase;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PatientCaseSensitiveInfoResponse {

    private String patientName;

    private String patientIdDeidentified;
}