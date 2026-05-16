package com.g20.backend.pneumovision.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.g20.backend.pneumovision.common.exception.BusinessException;
import com.g20.backend.pneumovision.dto.dicom.DicomExportMetadata;
import com.g20.backend.pneumovision.dto.dicom.DicomImportRequest;
import com.g20.backend.pneumovision.dto.dicom.DicomImportResponse;
import com.g20.backend.pneumovision.dto.dicom.DicomParseResponse;
import com.g20.backend.pneumovision.entity.ImageAsset;
import com.g20.backend.pneumovision.entity.PatientCase;
import com.g20.backend.pneumovision.entity.Study;
import com.g20.backend.pneumovision.repository.ImageAssetRepository;
import com.g20.backend.pneumovision.repository.PatientCaseRepository;
import com.g20.backend.pneumovision.repository.StudyRepository;
import com.g20.backend.pneumovision.security.LoginUser;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.dcm4che3.data.Attributes;
import org.dcm4che3.data.Tag;
import org.dcm4che3.io.DicomInputStream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
@RequiredArgsConstructor
public class DicomImportService {

    private final PatientCaseRepository patientCaseRepository;
    private final StudyRepository studyRepository;
    private final ImageAssetRepository imageAssetRepository;
    private final PatientCaseAccessService patientCaseAccessService;

    @Value("${file.upload-dir:uploads/images}")
    private String uploadDir;

    @Value("${file.max-size-bytes:52428800}")
    private long maxFileSizeBytes;

    @Value("${fastapi.base-url:http://localhost:8081}")
    private String fastApiBaseUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @Transactional(readOnly = true)
    public DicomParseResponse parse(MultipartFile file, LoginUser currentUser) {
        if (currentUser == null) {
            throw new BusinessException("未登录或登录状态已失效");
        }

        validateDicomFile(file);

        ParsedDicomMeta meta = parseDicomMeta(file);

        return toParseResponse(meta);
    }

    @Transactional(rollbackFor = Exception.class)
    public DicomImportResponse importDicom(DicomImportRequest request, LoginUser currentUser) {
        if (currentUser == null) {
            throw new BusinessException("未登录或登录状态已失效");
        }

        if (request == null) {
            throw new BusinessException("导入请求不能为空");
        }

        validateDicomFile(request.getFile());

        ParsedDicomMeta meta = parseDicomMeta(request.getFile());

        PatientCase patientCase;
        boolean createdNewCase;

        if (request.getPatientCaseId() != null) {
            patientCase = useExistingPatientCase(request.getPatientCaseId(), currentUser);
            createdNewCase = false;
        } else {
            patientCase = createPatientCase(request, meta, currentUser);
            createdNewCase = true;
        }

        Study study = createStudy(patientCase, request, meta);

        StoredImage storedImage = convertDicomToPngByFastApiAndSave(request.getFile());

        ImageAsset imageAsset = ImageAsset.builder()
                .studyId(study.getId())
                .patientCaseId(patientCase.getId())
                .fileName(storedImage.fileName())
                .filePath(storedImage.filePath())
                .fileFormat(storedImage.fileFormat())
                .fileSize(storedImage.fileSize())
                .uploadedBy(currentUser.getId())
                .build();

        ImageAsset savedImage = imageAssetRepository.save(imageAsset);

        return DicomImportResponse.builder()
                .patientCaseId(patientCase.getId())
                .caseNumber(patientCase.getCaseNumber())
                .studyId(study.getId())
                .imageId(savedImage.getId())
                .createdNewCase(createdNewCase)
                .parsed(toParseResponse(meta))
                .build();
    }

    @Transactional(readOnly = true)
    public DicomExportZip exportDicomAsZip(MultipartFile file, LoginUser currentUser) {
        if (currentUser == null) {
            throw new BusinessException("未登录或登录状态已失效");
        }

        validateDicomFile(file);

        ParsedDicomMeta meta = parseDicomMeta(file);

        byte[] pngBytes = requestPngBytesFromFastApi(file);

        PngSize pngSize = readPngSize(pngBytes);

        String originalFilename = file.getOriginalFilename();
        String cleanFileName = originalFilename == null
                ? "dicom-image.dcm"
                : Paths.get(originalFilename).getFileName().toString();

        String baseName = removeExtension(cleanFileName);
        if (!StringUtils.hasText(baseName)) {
            baseName = "dicom-image";
        }

        ExportedPng exportedPng = new ExportedPng(
                baseName + ".png",
                pngBytes,
                pngSize.width(),
                pngSize.height()
        );

        DicomExportMetadata metadata = DicomExportMetadata.builder()
                .patientName(meta.getPatientName())
                .patientId(meta.getPatientId())
                .sex(meta.getSex())
                .age(meta.getAge())
                .studyDate(meta.getStudyDate())
                .studyTime(meta.getStudyTime())
                .modality(meta.getModality())
                .specificCharacterSet(meta.getSpecificCharacterSet())
                .missingFields(toMissingFields(meta))
                .image(DicomExportMetadata.ImageInfo.builder()
                        .fileName(exportedPng.fileName())
                        .fileFormat("png")
                        .width(exportedPng.width())
                        .height(exportedPng.height())
                        .build())
                .build();

        byte[] zipBytes = buildZip(metadata, exportedPng);

        String zipName = "dicom-export-"
                + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
                + ".zip";

        return new DicomExportZip(zipName, zipBytes);
    }

    private PatientCase useExistingPatientCase(Long patientCaseId, LoginUser currentUser) {
        patientCaseAccessService.assertDoctorOwnsPatientCase(currentUser, patientCaseId);

        return patientCaseRepository.findById(patientCaseId)
                .orElseThrow(() -> new BusinessException("病例不存在"));
    }

    private PatientCase createPatientCase(DicomImportRequest request,
                                          ParsedDicomMeta meta,
                                          LoginUser currentUser) {
        String caseNumber = trimToNull(request.getCaseNumber());
        if (caseNumber == null) {
            caseNumber = generateCaseNumber();
        }

        if (patientCaseRepository.existsByCaseNumber(caseNumber)) {
            throw new BusinessException("病例编号已存在：" + caseNumber);
        }

        String patientName = firstNonBlank(
                request.getPatientName(),
                meta.getPatientName()
        );

        String patientIdDeidentified = firstNonBlank(
                request.getPatientIdDeidentified(),
                meta.getPatientId()
        );

        String gender = firstNonBlank(
                request.getGender(),
                meta.getSex()
        );

        Integer age = request.getAge() != null
                ? request.getAge()
                : meta.getAge();

        String caseDescription = trimToNull(request.getCaseDescription());

        PatientCase patientCase = PatientCase.builder()
                .caseNumber(limitLength(caseNumber, 50))
                .patientName(limitLength(patientName, 100))
                .patientIdDeidentified(limitLength(patientIdDeidentified, 64))
                .gender(gender)
                .age(age)
                .createdBy(currentUser.getId())
                .remark(limitLength(caseDescription, 500))
                .build();

        return patientCaseRepository.save(patientCase);
    }

    private Study createStudy(PatientCase patientCase,
                              DicomImportRequest request,
                              ParsedDicomMeta meta) {
        LocalDate studyDate = request.getStudyDate() != null
                ? request.getStudyDate()
                : meta.getStudyDate();

        LocalTime studyTimeOnly = request.getStudyTime() != null
                ? request.getStudyTime()
                : meta.getStudyTime();

        LocalDateTime studyTime = combineStudyDateTime(studyDate, studyTimeOnly);

        if (studyTime == null) {
            throw new BusinessException("检查日期或检查时间为空，请补充后再导入");
        }

        String modality = firstNonBlank(
                request.getModality(),
                meta.getModality()
        );

        if (modality == null) {
            throw new BusinessException("检查模态为空，请补充后再导入");
        }

        String studyDescription = trimToNull(request.getStudyDescription());

        Study study = Study.builder()
                .patientCaseId(patientCase.getId())
                .studyTime(studyTime)
                .modality(limitLength(modality, 10))
                .description(limitLength(studyDescription, 500))
                .build();

        return studyRepository.save(study);
    }

    private StoredImage convertDicomToPngByFastApiAndSave(MultipartFile file) {
        try {
            byte[] pngBytes = requestPngBytesFromFastApi(file);

            Path uploadPath = Paths.get(uploadDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            String originalFilename = file.getOriginalFilename();
            String cleanFileName = originalFilename == null
                    ? "unknown.dcm"
                    : Paths.get(originalFilename).getFileName().toString();

            String baseName = removeExtension(cleanFileName);
            if (!StringUtils.hasText(baseName)) {
                baseName = "dicom-image";
            }

            String pngFileName = UUID.randomUUID() + "_" + baseName + ".png";
            Path pngPath = uploadPath.resolve(pngFileName);

            Files.write(pngPath, pngBytes);

            return new StoredImage(
                    baseName + ".png",
                    pngPath.toString(),
                    "png",
                    Files.size(pngPath)
            );
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("调用 FastAPI 转换 DICOM 图片失败：" + e.getMessage());
        }
    }

    private byte[] requestPngBytesFromFastApi(MultipartFile file) {
        try {
            String url = fastApiBaseUrl + "/api/dicom/convert-to-png";

            ByteArrayResource fileResource = new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    String originalFilename = file.getOriginalFilename();
                    return originalFilename == null ? "image.dcm" : originalFilename;
                }
            };

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", fileResource);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            HttpEntity<MultiValueMap<String, Object>> requestEntity =
                    new HttpEntity<>(body, headers);

            ResponseEntity<byte[]> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    requestEntity,
                    byte[].class
            );

            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new BusinessException("FastAPI DICOM 转 PNG 失败，状态码：" + response.getStatusCode());
            }

            byte[] bodyBytes = response.getBody();

            if (bodyBytes == null || bodyBytes.length == 0) {
                throw new BusinessException("FastAPI DICOM 转 PNG 返回内容为空");
            }

            return bodyBytes;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("请求 FastAPI DICOM 转 PNG 接口失败：" + e.getMessage());
        }
    }

    private ParsedDicomMeta parseDicomMeta(MultipartFile file) {
        try (DicomInputStream dis = new DicomInputStream(file.getInputStream())) {
            Attributes attrs = dis.readDataset(-1, -1);

            ParsedDicomMeta meta = new ParsedDicomMeta();

            String rawPatientName = attrs.getString(Tag.PatientName);
            String rawPatientId = attrs.getString(Tag.PatientID);
            String rawSex = attrs.getString(Tag.PatientSex);
            String rawAge = attrs.getString(Tag.PatientAge);
            String rawStudyDate = attrs.getString(Tag.StudyDate);
            String rawStudyTime = attrs.getString(Tag.StudyTime);
            String rawModality = attrs.getString(Tag.Modality);
            String rawSpecificCharacterSet = attrs.getString(Tag.SpecificCharacterSet);

            meta.setPatientName(normalizePatientName(rawPatientName));
            meta.setPatientId(trimToNull(rawPatientId));
            meta.setSex(normalizeSex(rawSex));
            meta.setAge(parseAge(rawAge));
            meta.setStudyDate(parseDicomDate(rawStudyDate));
            meta.setStudyTime(parseDicomTime(rawStudyTime));
            meta.setModality(trimToNull(rawModality));
            meta.setSpecificCharacterSet(firstNonBlank(
                    rawSpecificCharacterSet,
                    "ISO_IR 6(default)"
            ));

            return meta;
        } catch (Exception e) {
            throw new BusinessException("DICOM 解析失败：" + e.getMessage());
        }
    }

    private DicomParseResponse toParseResponse(ParsedDicomMeta meta) {
        return DicomParseResponse.builder()
                .patientName(meta.getPatientName())
                .patientId(meta.getPatientId())
                .sex(meta.getSex())
                .age(meta.getAge())
                .studyDate(meta.getStudyDate())
                .studyTime(meta.getStudyTime())
                .modality(meta.getModality())
                .specificCharacterSet(meta.getSpecificCharacterSet())
                .missingFields(toMissingFields(meta))
                .build();
    }

    private List<String> toMissingFields(ParsedDicomMeta meta) {
        List<String> missingFields = new ArrayList<>();

        if (meta.getPatientName() == null) {
            missingFields.add("patientName");
        }
        if (meta.getPatientId() == null) {
            missingFields.add("patientId");
        }
        if (meta.getSex() == null) {
            missingFields.add("sex");
        }
        if (meta.getAge() == null) {
            missingFields.add("age");
        }
        if (meta.getStudyDate() == null) {
            missingFields.add("studyDate");
        }
        if (meta.getStudyTime() == null) {
            missingFields.add("studyTime");
        }
        if (meta.getModality() == null) {
            missingFields.add("modality");
        }

        return missingFields;
    }

    private byte[] buildZip(DicomExportMetadata metadata, ExportedPng exportedPng) {
        try {
            ByteArrayOutputStream zipBuffer = new ByteArrayOutputStream();

            try (ZipOutputStream zipOutputStream = new ZipOutputStream(zipBuffer)) {
                byte[] metadataBytes = objectMapper
                        .writerWithDefaultPrettyPrinter()
                        .writeValueAsBytes(metadata);

                ZipEntry metadataEntry = new ZipEntry("metadata.json");
                zipOutputStream.putNextEntry(metadataEntry);
                zipOutputStream.write(metadataBytes);
                zipOutputStream.closeEntry();

                ZipEntry imageEntry = new ZipEntry(exportedPng.fileName());
                zipOutputStream.putNextEntry(imageEntry);
                zipOutputStream.write(exportedPng.bytes());
                zipOutputStream.closeEntry();
            }

            return zipBuffer.toByteArray();
        } catch (Exception e) {
            throw new BusinessException("生成 DICOM 导出 zip 失败：" + e.getMessage());
        }
    }

    private PngSize readPngSize(byte[] pngBytes) {
        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(pngBytes));
            if (image == null) {
                return new PngSize(null, null);
            }
            return new PngSize(image.getWidth(), image.getHeight());
        } catch (Exception e) {
            return new PngSize(null, null);
        }
    }

    private void validateDicomFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("DICOM 文件不能为空");
        }

        if (file.getSize() > maxFileSizeBytes) {
            throw new BusinessException("文件过大，最大支持 " + (maxFileSizeBytes / 1024 / 1024) + "MB");
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename != null) {
            String cleanFileName = Paths.get(originalFilename).getFileName().toString();
            String extension = extractExtension(cleanFileName);

            if (extension != null && !"dcm".equalsIgnoreCase(extension)) {
                throw new BusinessException("当前接口仅支持 DICOM 文件，请上传 .dcm 文件");
            }
        }
    }

    private String generateCaseNumber() {
        String time = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String random = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        return "CASE-" + time + "-" + random;
    }

    private LocalDateTime combineStudyDateTime(LocalDate date, LocalTime time) {
        if (date == null || time == null) {
            return null;
        }
        return LocalDateTime.of(date, time);
    }

    private LocalDate parseDicomDate(String raw) {
        String value = trimToNull(raw);
        if (value == null || value.length() < 8) {
            return null;
        }

        try {
            return LocalDate.parse(value.substring(0, 8), DateTimeFormatter.BASIC_ISO_DATE);
        } catch (Exception e) {
            return null;
        }
    }

    private LocalTime parseDicomTime(String raw) {
        String value = trimToNull(raw);
        if (value == null) {
            return null;
        }

        try {
            String main = value.split("\\.")[0];

            if (main.length() >= 6) {
                return LocalTime.of(
                        Integer.parseInt(main.substring(0, 2)),
                        Integer.parseInt(main.substring(2, 4)),
                        Integer.parseInt(main.substring(4, 6))
                );
            }

            if (main.length() >= 4) {
                return LocalTime.of(
                        Integer.parseInt(main.substring(0, 2)),
                        Integer.parseInt(main.substring(2, 4)),
                        0
                );
            }

            if (main.length() >= 2) {
                return LocalTime.of(
                        Integer.parseInt(main.substring(0, 2)),
                        0,
                        0
                );
            }

            return null;
        } catch (Exception e) {
            return null;
        }
    }

    private Integer parseAge(String rawAge) {
        String value = trimToNull(rawAge);
        if (value == null) {
            return null;
        }

        try {
            String digits = value.replaceAll("\\D", "");
            if (digits.isBlank()) {
                return null;
            }

            int number = Integer.parseInt(digits);
            String upper = value.toUpperCase();

            if (upper.endsWith("Y")) {
                return number;
            }

            if (upper.endsWith("M")) {
                return number / 12;
            }

            if (upper.endsWith("W")) {
                return 0;
            }

            if (upper.endsWith("D")) {
                return 0;
            }

            return number;
        } catch (Exception e) {
            return null;
        }
    }

    private String normalizeSex(String rawSex) {
        String value = trimToNull(rawSex);
        if (value == null) {
            return null;
        }

        return switch (value.toUpperCase()) {
            case "M" -> "男";
            case "F" -> "女";
            case "O" -> "其他";
            default -> value;
        };
    }

    private String normalizePatientName(String rawName) {
        String value = trimToNull(rawName);
        if (value == null) {
            return null;
        }

        String[] groups = value.split("=", -1);
        String selected = null;

        for (String group : groups) {
            if (containsCjk(group)) {
                selected = group;
                break;
            }
        }

        if (selected == null) {
            for (String group : groups) {
                if (StringUtils.hasText(group)) {
                    selected = group;
                    break;
                }
            }
        }

        if (selected == null) {
            return null;
        }

        selected = selected.trim();

        if (containsCjk(selected)) {
            return selected.replace("^", "").trim();
        }

        return selected.replace("^", " ").replaceAll("\\s+", " ").trim();
    }

    private boolean containsCjk(String value) {
        if (value == null) {
            return false;
        }

        for (int i = 0; i < value.length(); i++) {
            Character.UnicodeBlock block = Character.UnicodeBlock.of(value.charAt(i));
            if (block == Character.UnicodeBlock.CJK_UNIFIED_IDEOGRAPHS
                    || block == Character.UnicodeBlock.CJK_COMPATIBILITY_IDEOGRAPHS
                    || block == Character.UnicodeBlock.CJK_UNIFIED_IDEOGRAPHS_EXTENSION_A
                    || block == Character.UnicodeBlock.CJK_UNIFIED_IDEOGRAPHS_EXTENSION_B
                    || block == Character.UnicodeBlock.CJK_SYMBOLS_AND_PUNCTUATION) {
                return true;
            }
        }

        return false;
    }

    private String extractExtension(String fileName) {
        if (!StringUtils.hasText(fileName)) {
            return null;
        }

        int index = fileName.lastIndexOf(".");
        if (index < 0 || index >= fileName.length() - 1) {
            return null;
        }

        return fileName.substring(index + 1).toLowerCase();
    }

    private String removeExtension(String fileName) {
        if (!StringUtils.hasText(fileName)) {
            return null;
        }

        int index = fileName.lastIndexOf(".");
        if (index <= 0) {
            return fileName;
        }

        return fileName.substring(0, index);
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }

        for (String value : values) {
            String normalized = trimToNull(value);
            if (normalized != null) {
                return normalized;
            }
        }

        return null;
    }

    private String limitLength(String value, int maxLength) {
        if (value == null) {
            return null;
        }

        if (value.length() <= maxLength) {
            return value;
        }

        return value.substring(0, maxLength);
    }

    @Data
    private static class ParsedDicomMeta {
        private String patientName;
        private String patientId;
        private String sex;
        private Integer age;
        private LocalDate studyDate;
        private LocalTime studyTime;
        private String modality;
        private String specificCharacterSet;
    }

    private record StoredImage(
            String fileName,
            String filePath,
            String fileFormat,
            Long fileSize
    ) {
    }

    private record ExportedPng(
            String fileName,
            byte[] bytes,
            Integer width,
            Integer height
    ) {
    }

    private record PngSize(
            Integer width,
            Integer height
    ) {
    }

    public record DicomExportZip(
            String fileName,
            byte[] bytes
    ) {
    }
}