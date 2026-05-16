package com.g20.backend.pneumovision.service;

import com.g20.backend.pneumovision.common.enums.AuditActionEnum;
import com.g20.backend.pneumovision.common.enums.InferenceStatusEnum;
import com.g20.backend.pneumovision.common.exception.BusinessException;
import com.g20.backend.pneumovision.dto.inference.*;
import com.g20.backend.pneumovision.entity.*;
import com.g20.backend.pneumovision.repository.*;
import com.g20.backend.pneumovision.security.LoginUser;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Random;
import java.util.stream.Collectors;

import javax.imageio.ImageIO;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.g20.backend.pneumovision.common.util.InferenceCacheKeyUtil;
import com.g20.backend.pneumovision.dto.inference.CachedInferenceData;
import com.g20.backend.pneumovision.dto.inference.CachedInferenceItem;
import com.g20.backend.pneumovision.dto.model.ModelInfo;

/**
 * 推理任务相关业务逻辑。
 *
 * 当前实现为异步队列调用 FastAPI 推理服务：
 * - 创建任务 -> QUEUED（入 RabbitMQ）
 * - 消费者处理 -> RUNNING -> 调用 Python/FastAPI 推理 -> 写入 InferenceResult -> SUCCESS/FAILED
 *
 * 说明：
 * - runMockInference(...) 作为早期联调痕迹保留，不再作为正式推理入口使用。
 */
@Service
@RequiredArgsConstructor
public class InferenceTaskService {

    private final InferenceTaskRepository inferenceTaskRepository;
    private final InferenceResultRepository inferenceResultRepository;
    private final ImageAssetRepository imageAssetRepository;
    private final StudyRepository studyRepository;
    private final PatientCaseAccessService patientCaseAccessService;
    private final PatientCaseRepository patientCaseRepository;
    private final AuditService auditService;

    private final RestTemplate restTemplate;
    @Value("${fastapi.base-url}")
    private String fastApiBaseUrl;

    private final InferenceCacheService inferenceCacheService;
    private final ModelService modelService;
    private final ObjectMapper objectMapper;
    private final RabbitTemplate rabbitTemplate;

    @Value("${inference.queue.exchange}")
    private String inferenceQueueExchange;
    @Value("${inference.queue.routing-key}")
    private String inferenceQueueRoutingKey;

    @Transactional
    public InferenceTaskResponse createTask(InferenceTaskCreateRequest request, LoginUser currentUser) {
        if (currentUser == null) {
            throw new BusinessException("未登录或登录状态已失效");
        }

        // 校验影像是否存在
        ImageAsset imageAsset = imageAssetRepository.findById(request.getImageId())
                .orElseThrow(() -> new BusinessException("影像不存在"));
        patientCaseAccessService.assertDoctorOwnsImage(currentUser, imageAsset.getId());

        // 校验检查记录是否存在
        Study study = studyRepository.findById(imageAsset.getStudyId())
                .orElseThrow(() -> new BusinessException("关联检查记录不存在"));

        String modelId = request.getModelId().getValue();
        ensureModelEnabled(modelId);

        // 创建任务（PENDING）
        InferenceTask task = InferenceTask.builder()
                .imageId(imageAsset.getId())
                .studyId(study.getId())
                .modelId(modelId)
                .status(InferenceStatusEnum.PENDING)
                .createdBy(currentUser.getId())
                .build();
        task = inferenceTaskRepository.save(task);

        task.setStatus(InferenceStatusEnum.QUEUED);
        task = inferenceTaskRepository.save(task);

        InferenceTaskMessage message = InferenceTaskMessage.builder()
                .taskId(task.getId())
                .imageId(task.getImageId())
                .studyId(task.getStudyId())
                .modelId(task.getModelId())
                .createdBy(task.getCreatedBy())
                .requestedAt(LocalDateTime.now())
                .retryCount(0)
                .build();
        try {
            rabbitTemplate.convertAndSend(inferenceQueueExchange, inferenceQueueRoutingKey, message);
        } catch (Exception ex) {
            task.setStatus(InferenceStatusEnum.FAILED);
            task.setErrorMessage("任务入队失败: " + ex.getMessage());
            task.setFinishedAt(LocalDateTime.now());
            task = inferenceTaskRepository.save(task);
            throw new BusinessException(task.getErrorMessage());
        }

        // 审计日志：发起推理任务
        String target = "task:" + task.getId();
        String detail = "发起肺炎检测推理, imageId=" + imageAsset.getId()
                + ", modelId=" + modelId
                + ", asyncQueued=true";
        auditService.log(AuditActionEnum.INFERENCE_REQUEST, currentUser.getId(), currentUser.getUsername(), target, detail, null);

        return toResponse(task);
    }

    @Transactional
    public void processQueuedTask(InferenceTaskMessage message) {
        if (message == null || message.getTaskId() == null) {
            return;
        }
        InferenceTask task = inferenceTaskRepository.findById(message.getTaskId())
                .orElseThrow(() -> new BusinessException("推理任务不存在"));

        // 幂等保护：重复消息不再二次处理
        if (task.getStatus() == InferenceStatusEnum.SUCCESS || task.getStatus() == InferenceStatusEnum.FAILED) {
            return;
        }

        ImageAsset imageAsset = imageAssetRepository.findById(task.getImageId())
                .orElseThrow(() -> new BusinessException("影像不存在"));

        LocalDateTime start = LocalDateTime.now();
        task.setStatus(InferenceStatusEnum.RUNNING);
        task.setStartedAt(start);
        task.setErrorMessage(null);
        inferenceTaskRepository.save(task);

        try {
            inferenceResultRepository.deleteByTaskId(task.getId());
            String cacheKey = buildPredictCacheKey(imageAsset, task.getModelId());
            CachedInferenceData cachedData = inferenceCacheService.get(cacheKey, CachedInferenceData.class);
            if (cachedData != null) {
                if (cachedData.getModelId() != null && !cachedData.getModelId().isBlank()) {
                    task.setModelId(cachedData.getModelId());
                }
                saveCachedResultsToTask(task, imageAsset, cachedData);
            } else {
                PythonInferenceResponse pythonResponse = runFastApiInference(task, imageAsset, task.getModelId());
                if (pythonResponse != null && pythonResponse.getData() != null) {
                    task.setModelId(pythonResponse.getData().getModelId());
                }
                inferenceCacheService.put(cacheKey, toCachedInferenceData(pythonResponse));
            }

            LocalDateTime finish = LocalDateTime.now();
            task.setStatus(InferenceStatusEnum.SUCCESS);
            task.setFinishedAt(finish);
            task.setDurationMs(Duration.between(start, finish).toMillis());
            task.setErrorMessage(null);
            inferenceTaskRepository.save(task);
        } catch (Exception ex) {
            throw new BusinessException(ex.getMessage());
        }
    }

    @Transactional
    public void markTaskQueuedForRetry(Long taskId, int nextRetry, String reason) {
        InferenceTask task = inferenceTaskRepository.findById(taskId)
                .orElseThrow(() -> new BusinessException("推理任务不存在"));
        if (task.getStatus() == InferenceStatusEnum.SUCCESS) {
            return;
        }
        task.setStatus(InferenceStatusEnum.QUEUED);
        task.setErrorMessage("第 " + nextRetry + " 次重试排队中: " + reason);
        inferenceTaskRepository.save(task);
    }

    @Transactional
    public void markTaskFailed(Long taskId, String reason) {
        InferenceTask task = inferenceTaskRepository.findById(taskId)
                .orElseThrow(() -> new BusinessException("推理任务不存在"));
        LocalDateTime now = LocalDateTime.now();
        if (task.getStartedAt() == null) {
            task.setStartedAt(now);
        }
        task.setStatus(InferenceStatusEnum.FAILED);
        task.setFinishedAt(now);
        task.setDurationMs(Duration.between(task.getStartedAt(), now).toMillis());
        task.setErrorMessage(reason);
        inferenceTaskRepository.save(task);
    }

    @Transactional(readOnly = true)
    public InferenceTaskResponse getTask(Long taskId, LoginUser currentUser) {
        InferenceTask task = inferenceTaskRepository.findById(taskId)
                .orElseThrow(() -> new BusinessException("推理任务不存在"));
        patientCaseAccessService.assertDoctorOwnsImage(currentUser, task.getImageId());
        return toResponse(task);
    }

    @Transactional(readOnly = true)
    public List<InferenceTaskResponse> listByImageId(Long imageId, LoginUser currentUser) {
        patientCaseAccessService.assertDoctorOwnsImage(currentUser, imageId);
        return inferenceTaskRepository.findByImageIdOrderByCreatedAtDesc(imageId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<InferenceTaskResponse> listByStudyId(Long studyId, LoginUser currentUser) {
        patientCaseAccessService.assertDoctorOwnsStudy(currentUser, studyId);
        return inferenceTaskRepository.findByStudyIdOrderByCreatedAtDesc(studyId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<InferenceResultResponse> listResults(Long taskId, LoginUser currentUser) {
        InferenceTask task = inferenceTaskRepository.findById(taskId)
                .orElseThrow(() -> new BusinessException("推理任务不存在"));
        patientCaseAccessService.assertDoctorOwnsImage(currentUser, task.getImageId());

        return inferenceResultRepository.findByTaskId(task.getId())
                .stream()
                .map(this::toResultResponse)
                .collect(Collectors.toList());
    }

    /**
     * 保存医生修正后的检测框结果。
     *
     * 约定：前端传入的 x / y / width / height 是原图真实像素坐标，
     * 不受页面缩放、拖动、canvas 显示尺寸影响。
     *
     * 当前采用“整体替换”策略：
     * - 前端传来的列表 = 当前任务最终保留的检测框列表
     * - 前端不传的旧框 = 删除
     * - id 为空的框 = 新增
     * - id 有值的框 = 按传入值重新保存
     */
    @Transactional
    public List<InferenceResultResponse> saveResults(
            Long taskId,
            InferenceResultSaveRequest request,
            LoginUser currentUser
    ) {
        if (currentUser == null) {
            throw new BusinessException("未登录或登录状态已失效");
        }

        InferenceTask task = inferenceTaskRepository.findById(taskId)
                .orElseThrow(() -> new BusinessException("推理任务不存在"));
        patientCaseAccessService.assertDoctorOwnsImage(currentUser, task.getImageId());

        if (task.getStatus() != InferenceStatusEnum.SUCCESS) {
            throw new BusinessException("只有检测成功的任务才能修改检测框");
        }

        List<InferenceResultSaveItem> items = request.getResults();
        if (items == null) {
            throw new BusinessException("检测框列表不能为空");
        }

        // 整体替换：先删除当前任务原有结果
        inferenceResultRepository.deleteByTaskId(task.getId());

        List<InferenceResultSaveItem> validItems = items.stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        List<InferenceResult> entities;

        // 如果前端把所有框都删掉了，不能让结果表为空；
        // 应该保存一条 normal 结果，表示“无肺炎框 / 正常”
        if (validItems.isEmpty()) {
            InferenceResult normalResult = InferenceResult.builder()
                    .taskId(task.getId())
                    .imageId(task.getImageId())
                    .label("normal")
                    .score(null)
                    .x(null)
                    .y(null)
                    .width(null)
                    .height(null)
                    .maskPath(null)
                    .build();

            entities = List.of(normalResult);
        } else {
            entities = validItems.stream()
                    .map(item -> buildResultFromSaveItem(task, item))
                    .collect(Collectors.toList());
        }

        List<InferenceResult> saved = inferenceResultRepository.saveAll(entities);

        String target = "task:" + task.getId();
        String detail = "医生修正检测框, resultCount=" + saved.size()
                + (validItems.isEmpty() ? ", allBoxesRemoved=true, finalLabel=normal" : "");

        auditService.log(
                AuditActionEnum.INFERENCE_REVIEW,
                currentUser.getId(),
                currentUser.getUsername(),
                target,
                detail,
                null
        );

        return saved.stream()
                .map(this::toResultResponse)
                .collect(Collectors.toList());
    }

    private InferenceResult buildResultFromSaveItem(InferenceTask task, InferenceResultSaveItem item) {
        String label = item.getLabel();
        if (label == null || label.isBlank()) {
            label = "pneumonia";
        }

        Double x = item.getX();
        Double y = item.getY();
        Double width = item.getWidth();
        Double height = item.getHeight();

        if (x == null || y == null || width == null || height == null) {
            throw new BusinessException("检测框坐标不能为空");
        }

        if (x < 0 || y < 0 || width <= 0 || height <= 0) {
            throw new BusinessException("检测框坐标不合法");
        }

        if (item.getScore() != null && (item.getScore() < 0 || item.getScore() > 1)) {
            throw new BusinessException("置信度必须在 0 到 1 之间");
        }

        return InferenceResult.builder()
                .taskId(task.getId())
                .imageId(task.getImageId())
                .label(label)
                .score(item.getScore())
                .x(x)
                .y(y)
                .width(width)
                .height(height)
                .maskPath(item.getMaskPath())
                .build();
    }

    @Transactional(readOnly = true)
    public InferenceExportResponse exportResult(Long taskId, LoginUser currentUser) {
        InferenceTask task = inferenceTaskRepository.findById(taskId)
                .orElseThrow(() -> new BusinessException("推理任务不存在"));

        patientCaseAccessService.assertDoctorOwnsImage(currentUser, task.getImageId());

        if (task.getStatus() != InferenceStatusEnum.SUCCESS && task.getStatus() != InferenceStatusEnum.FAILED) {
            throw new BusinessException("任务未完成，暂不可导出");
        }

        List<InferenceResult> entities = inferenceResultRepository.findByTaskId(task.getId());
        List<InferenceResultResponse> results = entities.stream()
                .map(this::toResultResponse)
                .collect(Collectors.toList());

        ImageAsset image = imageAssetRepository.findById(task.getImageId())
                .orElseThrow(() -> new BusinessException("影像不存在"));

        Study study = null;
        PatientCase patientCase = null;

        if (image.getStudyId() != null) {
            study = studyRepository.findById(image.getStudyId()).orElse(null);
        }

        if (study != null && study.getPatientCaseId() != null) {
            patientCase = patientCaseRepository.findById(study.getPatientCaseId()).orElse(null);
        }

        String originalUrl = "/api/images/" + image.getId() + "/preview";

        String overlayUrl = null;
        if (task.getStatus() == InferenceStatusEnum.SUCCESS && supportsRasterOverlay(image.getFileFormat())) {
            overlayUrl = "/api/inference/tasks/" + task.getId() + "/overlay-preview";
        }

        LocalDateTime detectionTime = task.getFinishedAt() != null
                ? task.getFinishedAt()
                : (task.getStartedAt() != null ? task.getStartedAt() : task.getCreatedAt());

        return InferenceExportResponse.builder()
                .taskId(task.getId())
                .imageId(image.getId())
                .studyId(study != null ? study.getId() : image.getStudyId())
                .caseNumber(patientCase != null ? patientCase.getCaseNumber() : null)
                .detectionTime(detectionTime)
                .status(task.getStatus())
                .summaryLabel(summarizeExport(task.getStatus(), entities))
                .results(results)
                .originalImageUrl(originalUrl)
                .inferenceOverlayUrl(overlayUrl)
                .errorMessage(task.getStatus() == InferenceStatusEnum.FAILED ? task.getErrorMessage() : null)
                .build();
    }

    @Transactional(readOnly = true)
    public byte[] renderOverlayPreview(Long taskId, LoginUser currentUser) {
        InferenceTask task = inferenceTaskRepository.findById(taskId)
                .orElseThrow(() -> new BusinessException("推理任务不存在"));
        patientCaseAccessService.assertDoctorOwnsImage(currentUser, task.getImageId());

        if (task.getStatus() != InferenceStatusEnum.SUCCESS) {
            throw new BusinessException("仅成功的任务可生成带框预览");
        }

        ImageAsset image = imageAssetRepository.findById(task.getImageId())
                .orElseThrow(() -> new BusinessException("影像不存在"));
        if (!supportsRasterOverlay(image.getFileFormat())) {
            throw new BusinessException("当前影像格式不支持服务端绘制检测框");
        }

        File file = new File(image.getFilePath());
        if (!file.exists() || !file.isFile()) {
            throw new BusinessException("影像文件不存在");
        }

        List<InferenceResult> results = inferenceResultRepository.findByTaskId(task.getId());
        BufferedImage bi;
        try {
            bi = ImageIO.read(file);
        } catch (Exception e) {
            throw new BusinessException("无法读取影像: " + e.getMessage());
        }
        if (bi == null) {
            throw new BusinessException("无法解码影像文件");
        }

        Graphics2D g = bi.createGraphics();
        try {
            g.setColor(Color.RED);
            g.setStroke(new BasicStroke(3f));
            for (InferenceResult r : results) {
                if (!hasBoundingBox(r)) {
                    continue;
                }
                int x = (int) Math.round(r.getX());
                int y = (int) Math.round(r.getY());
                int w = (int) Math.round(r.getWidth());
                int h = (int) Math.round(r.getHeight());
                g.drawRect(x, y, w, h);
            }
        } finally {
            g.dispose();
        }

        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(bi, "png", baos);
            return baos.toByteArray();
        } catch (Exception e) {
            throw new BusinessException("生成预览图失败: " + e.getMessage());
        }
    }

    private boolean supportsRasterOverlay(String fileFormat) {
        if (fileFormat == null) {
            return false;
        }
        String f = fileFormat.toLowerCase();
        return f.equals("png") || f.equals("jpg") || f.equals("jpeg");
    }

    private boolean hasBoundingBox(InferenceResult r) {
        return r.getX() != null && r.getY() != null && r.getWidth() != null && r.getHeight() != null;
    }

    private String summarizeExport(InferenceStatusEnum status, List<InferenceResult> results) {
        if (status == InferenceStatusEnum.FAILED) {
            return "推理失败";
        }
        if (results == null || results.isEmpty()) {
            return "无结果";
        }
        boolean pneumoniaBox = results.stream()
                .anyMatch(r -> hasBoundingBox(r) && isPneumoniaLabel(r.getLabel()));
        if (pneumoniaBox) {
            return "肺炎";
        }
        return results.stream()
                .map(InferenceResult::getLabel)
                .filter(Objects::nonNull)
                .findFirst()
                .map(l -> l.equalsIgnoreCase("normal") ? "正常" : l)
                .orElse("未知");
    }

    private boolean isPneumoniaLabel(String label) {
        return label != null && label.toLowerCase().contains("pneum");
    }

    @Transactional
    public void reviewTask(Long taskId, InferenceReviewRequest request, LoginUser doctor) {
        if (doctor == null) {
            throw new BusinessException("未登录或登录状态已失效");
        }
        InferenceTask task = inferenceTaskRepository.findById(taskId)
                .orElseThrow(() -> new BusinessException("推理任务不存在"));
        patientCaseAccessService.assertDoctorOwnsImage(doctor, task.getImageId());


        task.setReviewComment(request.getComment());
        task.setReviewedBy(doctor.getId());
        task.setReviewedAt(LocalDateTime.now());
        task.setDoctorEvaluationStatus(request.getEvaluationStatus());
        inferenceTaskRepository.save(task);

        String target = "task:" + task.getId();
        String detail = "医生评价推理结果：" + request.getEvaluationStatus();
        auditService.log(AuditActionEnum.INFERENCE_REVIEW, doctor.getId(), doctor.getUsername(), target, detail, null);
    }

    private InferenceTaskResponse toResponse(InferenceTask task) {
        return InferenceTaskResponse.builder()
                .id(task.getId())
                .imageId(task.getImageId())
                .studyId(task.getStudyId())
                .modelId(task.getModelId())
                .status(task.getStatus())
                .durationMs(task.getDurationMs())
                .errorMessage(task.getErrorMessage())
                .createdBy(task.getCreatedBy())
                .createdAt(task.getCreatedAt())
                .startedAt(task.getStartedAt())
                .finishedAt(task.getFinishedAt())
                .reviewComment(task.getReviewComment())
                .reviewedBy(task.getReviewedBy())
                .reviewedAt(task.getReviewedAt())
                .doctorEvaluationStatus(task.getDoctorEvaluationStatus())
                .build();
    }

    private InferenceResultResponse toResultResponse(InferenceResult entity) {
        return InferenceResultResponse.builder()
                .id(entity.getId())
                .taskId(entity.getTaskId())
                .imageId(entity.getImageId())
                .label(entity.getLabel())
                .score(entity.getScore())
                .x(entity.getX())
                .y(entity.getY())
                .width(entity.getWidth())
                .height(entity.getHeight())
                .maskPath(entity.getMaskPath())
                .createdAt(entity.getCreatedAt())
                .build();
    }

    /**
     * 模拟推理过程：睡眠一小段时间，并为目标影像生成 1-2 个随机 bbox 结果。
     * 仅用于 MVP 联调，后续会被真实模型调用替换。
     */
    private void runMockInference(InferenceTask task, ImageAsset imageAsset) throws InterruptedException {
        Random random = new Random();

        // 模拟推理耗时 200~800ms
        long sleepMs = 200 + random.nextInt(600);
        Thread.sleep(sleepMs);

        int resultCount = 1 + random.nextInt(2);
        for (int i = 0; i < resultCount; i++) {
            double x = random.nextDouble(0.1, 0.6);
            double y = random.nextDouble(0.1, 0.6);
            double width = random.nextDouble(0.2, 0.4);
            double height = random.nextDouble(0.2, 0.4);
            double score = random.nextDouble(0.7, 0.99);

            InferenceResult result = InferenceResult.builder()
                    .taskId(task.getId())
                    .imageId(imageAsset.getId())
                    .label("pneumonia")
                    .score(score)
                    .x(x)
                    .y(y)
                    .width(width)
                    .height(height)
                    .build();
            inferenceResultRepository.save(result);
        }
    }

    /**
     * 调用 FastAPI 推理服务，转发影像文件并写入检测结果。
     * 用于替代 mock 推理，作为当前真实推理入口。
     */
    private PythonInferenceResponse runFastApiInference(
            InferenceTask task,
            ImageAsset imageAsset,
            String modelId) {
        // 影像文件本地路径，来自 image_asset.file_path
        String imagePath = imageAsset.getFilePath();

        if (imagePath == null || imagePath.isBlank()) {
            throw new BusinessException("影像文件路径为空");
        }

        File file = new File(imagePath);
        if (!file.exists() || !file.isFile()) {
            throw new BusinessException("影像文件不存在: " + imagePath);
        }

        String url = fastApiBaseUrl + "/api/inference/tasks/predict";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("imageId", imageAsset.getId().toString());
        body.add("modelId", modelId);


        body.add("file", new FileSystemResource(file));

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

        ResponseEntity<PythonInferenceResponse> responseEntity = restTemplate.exchange(
                url,
                HttpMethod.POST,
                requestEntity,
                PythonInferenceResponse.class
        );


        PythonInferenceResponse response = responseEntity.getBody();
        if (response == null) {
            throw new BusinessException("FastAPI 返回为空");
        }
        if (response.getCode() == null || response.getCode() != 200) {
            String msg;
            if (response.getError() != null && !response.getError().isBlank()) {
                if (response.getMessage() != null && !response.getMessage().isBlank()) {
                    msg = response.getMessage() + ": " + response.getError();
                } else {
                    msg = response.getError();
                }
            } else {
                msg = response.getMessage();
            }
            throw new BusinessException(msg != null ? msg : "FastAPI 调用失败");
        }
        if (response.getData() == null) {
            throw new BusinessException("FastAPI 返回 data 为空");
        }

        List<PythonInferenceResponse.ResultItem> results = response.getData().getResults();

        if (results != null && !results.isEmpty()) {
            for (PythonInferenceResponse.ResultItem item : results) {
                InferenceResult result = InferenceResult.builder()
                        .taskId(task.getId())
                        .imageId(imageAsset.getId())
                        .label(item.getLabel())
                        .score(item.getScore())
                        .x(item.getX())
                        .y(item.getY())
                        .width(item.getWidth())
                        .height(item.getHeight())
                        .maskPath(item.getMaskPath())
                        .build();
                inferenceResultRepository.save(result);
            }
        } else {
            String finalLabel = response.getData().getPredLabel();
            if (finalLabel == null || finalLabel.isBlank()) {
                finalLabel = "unknown";
            }

            InferenceResult result = InferenceResult.builder()
                    .taskId(task.getId())
                    .imageId(imageAsset.getId())
                    .label(finalLabel)
                    .score(null)
                    .x(null)
                    .y(null)
                    .width(null)
                    .height(null)
                    .maskPath(null)
                    .build();

            inferenceResultRepository.save(result);
        }

        return response;
    }

    private String buildPredictCacheKey(ImageAsset imageAsset, String modelId) {
        try {
            File file = new File(imageAsset.getFilePath());
            if (!file.exists() || !file.isFile()) {
                throw new BusinessException("影像文件不存在: " + imageAsset.getFilePath());
            }

            byte[] imageBytes = java.nio.file.Files.readAllBytes(file.toPath());
            String imageHash = InferenceCacheKeyUtil.sha256(imageBytes);

            ModelInfo modelInfo = modelService.listModels().get(modelId);
            if (modelInfo == null) {
                throw new BusinessException("模型不存在: " + modelId);
            }
            if (modelInfo.getParams() == null) {
                throw new BusinessException("模型参数不存在: " + modelId);
            }

            String paramsHash = InferenceCacheKeyUtil.buildParamsHash(
                    objectMapper,
                    modelInfo.getParams().getConf(),
                    modelInfo.getParams().getIou(),
                    modelInfo.getParams().getMaxDet(),
                    modelInfo.getParams().getTopK()
            );

            return InferenceCacheKeyUtil.buildKey(modelId, paramsHash, imageHash);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("生成推理缓存键失败: " + e.getMessage());
        }
    }

    private void ensureModelEnabled(String modelId) {
        ModelInfo modelInfo = modelService.listModels().get(modelId);
        if (modelInfo == null) {
            throw new BusinessException("模型不存在: " + modelId);
        }
        if (!Boolean.TRUE.equals(modelInfo.getEnabled())) {
            throw new BusinessException("模型已禁用，无法发起推理: " + modelId);
        }
    }

    private void saveCachedResultsToTask(InferenceTask task, ImageAsset imageAsset, CachedInferenceData cachedData) {
        if (cachedData == null) {
            return;
        }

        List<CachedInferenceItem> results = cachedData.getResults();
        if (results != null && !results.isEmpty()) {
            for (CachedInferenceItem item : results) {
                InferenceResult result = InferenceResult.builder()
                        .taskId(task.getId())
                        .imageId(imageAsset.getId())
                        .label(item.getLabel())
                        .score(item.getScore())
                        .x(item.getX())
                        .y(item.getY())
                        .width(item.getWidth())
                        .height(item.getHeight())
                        .maskPath(item.getMaskPath())
                        .build();
                inferenceResultRepository.save(result);
            }
        } else {
            String finalLabel = cachedData.getPredLabel();
            if (finalLabel == null || finalLabel.isBlank()) {
                finalLabel = "unknown";
            }

            InferenceResult result = InferenceResult.builder()
                    .taskId(task.getId())
                    .imageId(imageAsset.getId())
                    .label(finalLabel)
                    .score(null)
                    .x(null)
                    .y(null)
                    .width(null)
                    .height(null)
                    .maskPath(null)
                    .build();
            inferenceResultRepository.save(result);
        }
    }

    private CachedInferenceData toCachedInferenceData(PythonInferenceResponse response) {
        CachedInferenceData cached = new CachedInferenceData();

        if (response == null || response.getData() == null) {
            return cached;
        }

        cached.setModelId(response.getData().getModelId());
        cached.setPredLabel(response.getData().getPredLabel());

        if (response.getData().getResults() != null) {
            List<CachedInferenceItem> items = response.getData().getResults().stream().map(item -> {
                CachedInferenceItem ci = new CachedInferenceItem();
                ci.setLabel(item.getLabel());
                ci.setScore(item.getScore());
                ci.setX(item.getX());
                ci.setY(item.getY());
                ci.setWidth(item.getWidth());
                ci.setHeight(item.getHeight());
                ci.setMaskPath(item.getMaskPath());
                return ci;
            }).collect(Collectors.toList());

            cached.setResults(items);
        }

        return cached;
    }
}
