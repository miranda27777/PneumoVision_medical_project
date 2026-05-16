package com.g20.backend.pneumovision.service;

import com.g20.backend.pneumovision.common.enums.InferenceStatusEnum;
import com.g20.backend.pneumovision.common.exception.BusinessException;
import com.g20.backend.pneumovision.dto.inference.InferenceExportResponse;
import com.g20.backend.pneumovision.dto.inference.InferenceResultResponse;
import com.g20.backend.pneumovision.entity.ImageAsset;
import com.g20.backend.pneumovision.entity.InferenceTask;
import com.g20.backend.pneumovision.entity.PatientCase;
import com.g20.backend.pneumovision.entity.Study;
import com.g20.backend.pneumovision.repository.ImageAssetRepository;
import com.g20.backend.pneumovision.repository.InferenceTaskRepository;
import com.g20.backend.pneumovision.repository.PatientCaseRepository;
import com.g20.backend.pneumovision.repository.StudyRepository;
import com.g20.backend.pneumovision.security.LoginUser;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.ImageIO;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * 将单次推理导出为 PDF：检测时间、文字结论与明细、原图、带框推理图。
 */
@Service
@RequiredArgsConstructor
public class InferenceExportPdfService {

    private static final DateTimeFormatter CN_TIME =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss", Locale.CHINA);

    /**
     * 文字先按该倍数画成位图再嵌入 PDF，提高有效分辨率，避免发糊。
     */
    private static final int TEXT_RASTER_SCALE = 3;

    /** 版心内卡片统一宽度 */
    private static final int PANEL_CONTENT_WIDTH = 515;

    private static final Color C_PAGE_BG = new Color(248, 250, 252);
    private static final Color C_ACCENT = new Color(44, 82, 130);
    private static final Color C_ACCENT_BRIGHT = new Color(49, 130, 206);
    private static final Color C_PANEL_BG = new Color(237, 242, 247);
    private static final Color C_PANEL_BORDER = new Color(203, 213, 224);
    private static final Color C_TITLE_ON_BLUE = Color.WHITE;
    private static final Color C_SUB_ON_BLUE = new Color(226, 232, 240);
    private static final Color C_SECTION_TITLE = new Color(26, 54, 93);
    private static final Color C_BODY = new Color(45, 55, 72);

    private final InferenceTaskService inferenceTaskService;
    private final InferenceTaskRepository inferenceTaskRepository;
    private final ImageAssetRepository imageAssetRepository;
    private final StudyRepository studyRepository;
    private final PatientCaseRepository patientCaseRepository;

    @Transactional(readOnly = true)
    public byte[] buildExportPdf(Long taskId, LoginUser user) {
        InferenceExportResponse meta = inferenceTaskService.exportResult(taskId, user);

        InferenceTask task = inferenceTaskRepository.findById(taskId)
                .orElseThrow(() -> new BusinessException("推理任务不存在"));

        ImageAsset image = imageAssetRepository.findById(task.getImageId())
                .orElseThrow(() -> new BusinessException("影像不存在"));

        if (!supportsRasterPdf(image.getFileFormat())) {
            throw new BusinessException("PDF 导出暂仅支持 PNG、JPG 影像");
        }

        Study study = null;
        PatientCase patientCase = null;

        if (image.getStudyId() != null) {
            study = studyRepository.findById(image.getStudyId()).orElse(null);
        }

        if (study != null && study.getPatientCaseId() != null) {
            patientCase = patientCaseRepository.findById(study.getPatientCaseId()).orElse(null);
        }

        byte[] originalPng = readImageFileAsPng(image.getFilePath());

        try {
            byte[] overlayPng = null;

            if (task.getStatus() == InferenceStatusEnum.SUCCESS) {
                overlayPng = renderOverlayWithLabels(originalPng, meta.getResults());
            }

            return renderPdf(meta, originalPng, overlayPng, task, image, study, patientCase);
        } catch (IOException e) {
            throw new BusinessException("生成 PDF 失败: " + e.getMessage());
        }
    }

    private boolean supportsRasterPdf(String fileFormat) {
        if (fileFormat == null) {
            return false;
        }

        String f = fileFormat.toLowerCase(Locale.ROOT);
        return f.equals("png") || f.equals("jpg") || f.equals("jpeg");
    }

    private byte[] readImageFileAsPng(String filePath) {
        File file = new File(filePath);

        if (!file.exists() || !file.isFile()) {
            throw new BusinessException("影像文件不存在");
        }

        try {
            BufferedImage bi = ImageIO.read(file);
            if (bi == null) {
                throw new BusinessException("无法解码影像文件");
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(bi, "png", baos);
            return baos.toByteArray();
        } catch (IOException e) {
            throw new BusinessException("读取影像失败: " + e.getMessage());
        }
    }

    private byte[] renderPdf(
            InferenceExportResponse meta,
            byte[] originalPng,
            byte[] overlayPng,
            InferenceTask task,
            ImageAsset image,
            Study study,
            PatientCase patientCase
    ) throws IOException {
        List<String> metaLines = new ArrayList<>();

        metaLines.add("病例编号: " + (
                patientCase != null && patientCase.getCaseNumber() != null
                        ? patientCase.getCaseNumber()
                        : "-"
        ));

        metaLines.add("Study ID: " + (
                study != null && study.getId() != null
                        ? study.getId()
                        : image.getStudyId()
        ));

        metaLines.add("Image ID: " + (
                image.getId() != null
                        ? image.getId()
                        : "-"
        ));

        metaLines.add("Task ID: " + (
                task.getId() != null
                        ? task.getId()
                        : "-"
        ));

        metaLines.add("检测时间: " + (
                meta.getDetectionTime() != null
                        ? CN_TIME.format(meta.getDetectionTime())
                        : "-"
        ));

        metaLines.add("任务状态: " + statusLabel(meta.getStatus()));

        metaLines.add("简要结论: " + (
                meta.getSummaryLabel() != null
                        ? meta.getSummaryLabel()
                        : "-"
        ));

        if (meta.getErrorMessage() != null && !meta.getErrorMessage().isBlank()) {
            metaLines.add("错误信息: " + meta.getErrorMessage());
        }

        List<String> detailBodyLines = new ArrayList<>();

        if (meta.getResults() == null || meta.getResults().isEmpty()) {
            detailBodyLines.add("(无框或模型未返回目标)");
        } else {
            int i = 1;

            for (InferenceResultResponse r : meta.getResults()) {
                String bbox = (
                        r.getX() != null &&
                                r.getY() != null &&
                                r.getWidth() != null &&
                                r.getHeight() != null
                )
                        ? String.format(
                        Locale.ROOT,
                        "框 [x=%.0f, y=%.0f, w=%.0f, h=%.0f]",
                        r.getX(),
                        r.getY(),
                        r.getWidth(),
                        r.getHeight()
                )
                        : "框 (无坐标)";

                String score = r.getScore() != null
                        ? String.format(Locale.ROOT, "置信度 %.4f", r.getScore())
                        : "医生标注";

                detailBodyLines.add(String.format(
                        Locale.ROOT,
                        "%d. 标签 %s  %s  %s",
                        i++,
                        r.getLabel() != null ? r.getLabel() : "-",
                        score,
                        bbox
                ));
            }
        }

        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);

            float pageW = page.getMediaBox().getWidth();
            float pageH = page.getMediaBox().getHeight();
            float margin = 40;
            float gap = 16;

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                fillPageBackground(cs, pageW, pageH);
                drawTopAccentStripe(cs, pageW, pageH);

                float cursorTop = pageH - margin;

                cursorTop = drawImageBlock(
                        doc,
                        cs,
                        titleBannerImage(PANEL_CONTENT_WIDTH),
                        margin,
                        cursorTop,
                        pageW - 2 * margin,
                        88,
                        gap
                );

                cursorTop = drawImageBlock(
                        doc,
                        cs,
                        sectionPanelImage("检测概要", metaLines, 15, 12),
                        margin,
                        cursorTop,
                        pageW - 2 * margin,
                        240,
                        gap
                );

                cursorTop = drawImageBlock(
                        doc,
                        cs,
                        sectionPanelImage("检测明细", detailBodyLines, 15, 12),
                        margin,
                        cursorTop,
                        pageW - 2 * margin,
                        320,
                        gap
                );

                drawHorizontalRule(cs, margin, pageW - margin, cursorTop + 6);

                float imgMaxW = (pageW - 2 * margin - gap) / 2f;
                float imgMaxH = 248f;
                float rowTop = cursorTop - 8;
                float captionGap = 5f;

                PDImageXObject orig = PDImageXObject.createFromByteArray(doc, originalPng, "orig");
                float[] sz1 = scaleToFit(orig.getWidth(), orig.getHeight(), imgMaxW, imgMaxH);

                PDImageXObject capOrig = toPdfImage(doc, plainCaptionImage("原图"), "capOrig");
                float capH = 22f;
                float capOrigScale = Math.min(imgMaxW / capOrig.getWidth(), capH / capOrig.getHeight());
                float capOrigW = capOrig.getWidth() * capOrigScale;
                float capOrigH = capOrig.getHeight() * capOrigScale;

                float yCapOrig = rowTop - capOrigH;
                float yImgOrig = yCapOrig - captionGap - sz1[1];

                float xRight = margin + imgMaxW + gap;
                float yImgOv;
                float[] sz2;
                PDImageXObject ov = null;
                PDImageXObject capOv = null;
                float capOvW = 0;
                float capOvH = 0;
                float yCapOv = 0;

                if (overlayPng != null) {
                    ov = PDImageXObject.createFromByteArray(doc, overlayPng, "ov");
                    sz2 = scaleToFit(ov.getWidth(), ov.getHeight(), imgMaxW, imgMaxH);

                    capOv = toPdfImage(doc, plainCaptionImage("推理标注图"), "capOv");
                    float capOvScale = Math.min(imgMaxW / capOv.getWidth(), capH / capOv.getHeight());
                    capOvW = capOv.getWidth() * capOvScale;
                    capOvH = capOv.getHeight() * capOvScale;

                    yCapOv = rowTop - capOvH;
                    yImgOv = yCapOv - captionGap - sz2[1];
                } else {
                    sz2 = new float[]{0, 0};
                    yImgOv = yImgOrig;
                }

                float columnLowY = Math.min(yImgOrig, yImgOv) - 6;
                float columnHighY = rowTop + 4;

                drawImageColumnMat(
                        cs,
                        margin - 4,
                        columnLowY,
                        imgMaxW + 8,
                        columnHighY - columnLowY
                );

                drawImageColumnMat(
                        cs,
                        xRight - 4,
                        columnLowY,
                        imgMaxW + 8,
                        columnHighY - columnLowY
                );

                cs.drawImage(capOrig, margin, yCapOrig, capOrigW, capOrigH);
                cs.drawImage(orig, margin, yImgOrig, sz1[0], sz1[1]);

                if (overlayPng != null) {
                    cs.drawImage(capOv, xRight, yCapOv, capOvW, capOvH);
                    cs.drawImage(ov, xRight, yImgOv, sz2[0], sz2[1]);
                } else {
                    String text = meta.getStatus() == InferenceStatusEnum.FAILED
                            ? "推理失败，无带框图"
                            : "无推理标注图";

                    PDImageXObject cap = toPdfImage(doc, plainCaptionImage(text), "capRight");
                    float[] szc = scaleToFit(cap.getWidth(), cap.getHeight(), imgMaxW, 100);
                    cs.drawImage(cap, xRight, rowTop - szc[1], szc[0], szc[1]);
                }

                drawFooter(cs, pageW, margin);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        }
    }

    private byte[] renderOverlayWithLabels(
            byte[] originalPng,
            List<InferenceResultResponse> results
    ) throws IOException {
        BufferedImage src = ImageIO.read(new ByteArrayInputStream(originalPng));

        if (src == null) {
            throw new BusinessException("无法解码影像文件");
        }

        int imgW = src.getWidth();
        int imgH = src.getHeight();

        BufferedImage out = new BufferedImage(imgW, imgH, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();

        try {
            configureTextGraphics(g);
            g.drawImage(src, 0, 0, null);

            int strokeWidth = Math.max(2, Math.round(imgW / 350f));
            g.setStroke(new BasicStroke(strokeWidth));

            int fontSize = Math.max(18, Math.round(imgW / 38f));
            Font labelFont = pickChineseFont(fontSize);

            if (labelFont.canDisplay('医')) {
                labelFont = labelFont.deriveFont(Font.BOLD);
            }

            g.setFont(labelFont);

            if (results != null) {
                for (InferenceResultResponse r : results) {
                    if (
                            r.getX() == null ||
                                    r.getY() == null ||
                                    r.getWidth() == null ||
                                    r.getHeight() == null
                    ) {
                        continue;
                    }

                    int x = clampInt(Math.round(r.getX().floatValue()), 0, imgW - 1);
                    int y = clampInt(Math.round(r.getY().floatValue()), 0, imgH - 1);
                    int w = Math.max(1, Math.min(Math.round(r.getWidth().floatValue()), imgW - x));
                    int h = Math.max(1, Math.min(Math.round(r.getHeight().floatValue()), imgH - y));

                    boolean doctorAnnotation = r.getScore() == null;

                    Color boxColor = doctorAnnotation
                            ? new Color(22, 163, 74)
                            : new Color(239, 68, 68);

                    g.setColor(boxColor);
                    g.drawRect(x, y, w, h);

                    String labelText;

                    if (doctorAnnotation) {
                        labelText = "医生标注";
                    } else {
                        String label = r.getLabel() != null ? r.getLabel() : "lesion";
                        labelText = String.format(
                                Locale.ROOT,
                                "%s %.3f",
                                label,
                                r.getScore().doubleValue()
                        );
                    }

                    drawBoxLabel(g, labelText, x, y, boxColor, imgW, imgH);
                }
            }
        } finally {
            g.dispose();
        }

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(out, "png", baos);
        return baos.toByteArray();
    }

    private void drawBoxLabel(
            Graphics2D g,
            String text,
            int boxX,
            int boxY,
            Color bgColor,
            int imgW,
            int imgH
    ) {
        FontMetrics fm = g.getFontMetrics();

        int padX = 8;
        int padY = 5;
        int labelW = fm.stringWidth(text) + padX * 2;
        int labelH = fm.getHeight() + padY * 2;

        int labelX = clampInt(boxX, 0, Math.max(0, imgW - labelW));

        int labelY = boxY - labelH;
        if (labelY < 0) {
            labelY = boxY;
        }

        labelY = clampInt(labelY, 0, Math.max(0, imgH - labelH));

        g.setColor(bgColor);
        g.fillRect(labelX, labelY, labelW, labelH);

        g.setColor(Color.WHITE);
        g.drawString(text, labelX + padX, labelY + padY + fm.getAscent());
    }

    private static int clampInt(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private static void fillPageBackground(PDPageContentStream cs, float pageW, float pageH)
            throws IOException {
        setFillRgb(cs, C_PAGE_BG);
        cs.addRect(0, 0, pageW, pageH);
        cs.fill();
    }

    private static void drawTopAccentStripe(PDPageContentStream cs, float pageW, float pageH)
            throws IOException {
        setFillRgb(cs, C_ACCENT);
        cs.addRect(0, pageH - 5, pageW, 5);
        cs.fill();
    }

    private static void drawHorizontalRule(PDPageContentStream cs, float x1, float x2, float y)
            throws IOException {
        cs.setStrokingColor(0.82f, 0.86f, 0.90f);
        cs.setLineWidth(0.8f);
        cs.moveTo(x1, y);
        cs.lineTo(x2, y);
        cs.stroke();
    }

    /**
     * 影像区浅底 + 细边框。
     */
    private static void drawImageColumnMat(PDPageContentStream cs, float x, float y, float w, float h)
            throws IOException {
        setFillRgb(cs, C_PANEL_BG);
        cs.addRect(x, y, w, h);
        cs.fill();

        float[] b = rgb(C_PANEL_BORDER);
        cs.setStrokingColor(b[0], b[1], b[2]);
        cs.setLineWidth(0.6f);
        cs.addRect(x, y, w, h);
        cs.stroke();
    }

    private static void drawFooter(PDPageContentStream cs, float pageW, float margin)
            throws IOException {
        float yLine = 42;

        cs.setStrokingColor(0.80f, 0.84f, 0.88f);
        cs.setLineWidth(0.5f);
        cs.moveTo(margin, yLine);
        cs.lineTo(pageW - margin, yLine);
        cs.stroke();

        cs.beginText();
        cs.setFont(PDType1Font.HELVETICA, 8);
        cs.setNonStrokingColor(0.45f, 0.48f, 0.52f);
        cs.newLineAtOffset(margin, 26);
        cs.showText("PneumoVision  AI-assisted chest imaging report  (auto-generated)");
        cs.endText();
    }

    private static float[] rgb(Color c) {
        return new float[]{
                c.getRed() / 255f,
                c.getGreen() / 255f,
                c.getBlue() / 255f
        };
    }

    private static void setFillRgb(PDPageContentStream cs, Color c)
            throws IOException {
        float[] v = rgb(c);
        cs.setNonStrokingColor(v[0], v[1], v[2]);
    }

    /**
     * 页眉标题条：渐变底 + 主副标题。
     */
    private BufferedImage titleBannerImage(int widthLogical) {
        int w = widthLogical;
        int h = 76;
        int s = TEXT_RASTER_SCALE;

        BufferedImage bi = new BufferedImage(w * s, h * s, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = bi.createGraphics();

        try {
            configureTextGraphics(g);
            g.scale(s, s);

            GradientPaint gp = new GradientPaint(
                    0,
                    0,
                    C_ACCENT,
                    w,
                    h,
                    C_ACCENT_BRIGHT
            );

            g.setPaint(gp);
            g.fillRect(0, 0, w, h);

            Font titleFont = pickChineseFont(20);
            if (titleFont.canDisplay('肺')) {
                titleFont = titleFont.deriveFont(Font.BOLD);
            }

            Font subFont = pickChineseFont(11);

            g.setFont(titleFont);
            FontMetrics fmT = g.getFontMetrics();
            String t1 = "肺炎智能检测报告";
            int tx = (w - fmT.stringWidth(t1)) / 2;
            int ty = 28;

            g.setColor(C_TITLE_ON_BLUE);
            g.drawString(t1, tx, ty);

            g.setFont(subFont);
            FontMetrics fmS = g.getFontMetrics();
            String t2 = "智能辅助阅片 · 单次推理导出";
            int sx = (w - fmS.stringWidth(t2)) / 2;

            g.setColor(C_SUB_ON_BLUE);
            g.drawString(t2, sx, ty + 26);
        } finally {
            g.dispose();
        }

        return bi;
    }

    /**
     * 分区卡片：左侧色条 + 标题行 + 正文。
     */
    private BufferedImage sectionPanelImage(
            String sectionTitle,
            List<String> bodyLines,
            int titlePx,
            int bodyPx
    ) {
        int accentW = 6;
        int padX = 18;
        int padY = 14;
        int gapTitleBody = 10;
        int maxInner = PANEL_CONTENT_WIDTH - padX * 2 - accentW;

        Font titleFont = pickChineseFont(titlePx);
        if (titleFont.canDisplay('检')) {
            titleFont = titleFont.deriveFont(Font.BOLD);
        }

        Font bodyFont = pickChineseFont(bodyPx);

        BufferedImage measure = new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB);
        Graphics2D mg = measure.createGraphics();

        mg.setFont(bodyFont);
        FontMetrics fmBody = mg.getFontMetrics();
        int lineH = fmBody.getHeight();

        mg.setFont(titleFont);
        FontMetrics fmTitle = mg.getFontMetrics();
        int titleH = fmTitle.getHeight();

        List<String> wrapped = new ArrayList<>();
        for (String line : bodyLines) {
            wrapLine(line, fmBody, maxInner, wrapped);
        }

        int contentH = padY + titleH + gapTitleBody + wrapped.size() * lineH + padY;
        int h = Math.max(contentH, padY * 2 + titleH + lineH);
        int w = PANEL_CONTENT_WIDTH;

        mg.dispose();

        int sc = TEXT_RASTER_SCALE;
        BufferedImage bi = new BufferedImage(w * sc, h * sc, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = bi.createGraphics();

        try {
            configureTextGraphics(g);
            g.scale(sc, sc);

            g.setColor(C_PANEL_BG);
            g.fillRect(0, 0, w, h);

            g.setColor(C_ACCENT_BRIGHT);
            g.fillRect(0, 0, accentW, h);

            g.setColor(C_PANEL_BORDER);
            g.drawRect(0, 0, w - 1, h - 1);

            int xText = accentW + padX;

            g.setFont(titleFont);
            g.setColor(C_SECTION_TITLE);
            g.drawString(sectionTitle, xText, padY + fmTitle.getAscent());

            g.setFont(bodyFont);
            g.setColor(C_BODY);

            int y = padY + titleH + gapTitleBody + fmBody.getAscent();
            for (String line : wrapped) {
                g.drawString(line, xText, y);
                y += lineH;
            }
        } finally {
            g.dispose();
        }

        return bi;
    }

    /**
     * 普通文字图题，不再画成按钮样式。
     */
    private BufferedImage plainCaptionImage(String text) {
        Font font = pickChineseFont(13);
        if (font.canDisplay('原')) {
            font = font.deriveFont(Font.BOLD);
        }

        BufferedImage m = new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB);
        Graphics2D mg = m.createGraphics();

        mg.setFont(font);
        FontMetrics fm = mg.getFontMetrics();

        int w = fm.stringWidth(text) + 4;
        int h = fm.getHeight() + 6;

        mg.dispose();

        int s = TEXT_RASTER_SCALE;
        BufferedImage bi = new BufferedImage(w * s, h * s, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = bi.createGraphics();

        try {
            configureTextGraphics(g);
            g.scale(s, s);

            g.setColor(C_PANEL_BG);
            g.fillRect(0, 0, w, h);

            g.setFont(font);
            g.setColor(C_SECTION_TITLE);
            g.drawString(text, 2, 3 + fm.getAscent());
        } finally {
            g.dispose();
        }

        return bi;
    }

    private static String statusLabel(InferenceStatusEnum s) {
        if (s == null) {
            return "-";
        }

        return switch (s) {
            case SUCCESS -> "成功";
            case FAILED -> "失败";
            case PENDING -> "待处理";
            case QUEUED -> "队列中";
            case RUNNING -> "进行中";
        };
    }

    private static PDImageXObject toPdfImage(PDDocument doc, BufferedImage bi, String name)
            throws IOException {
        ByteArrayOutputStream tmp = new ByteArrayOutputStream();
        ImageIO.write(bi, "png", tmp);
        return PDImageXObject.createFromByteArray(doc, tmp.toByteArray(), name);
    }

    private float drawImageBlock(
            PDDocument doc,
            PDPageContentStream cs,
            BufferedImage img,
            float x,
            float cursorTop,
            float maxW,
            float maxH,
            float gapAfter
    ) throws IOException {
        PDImageXObject pdx = toPdfImage(doc, img, "blk");
        float[] sz = scaleToFit(pdx.getWidth(), pdx.getHeight(), maxW, maxH);
        float lowerLeftY = cursorTop - sz[1];

        cs.drawImage(pdx, x, lowerLeftY, sz[0], sz[1]);

        return lowerLeftY - gapAfter;
    }

    private static float[] scaleToFit(float w, float h, float maxW, float maxH) {
        float scale = Math.min(maxW / w, maxH / h);
        return new float[]{w * scale, h * scale};
    }

    private static void wrapLine(String text, FontMetrics fm, int maxInnerW, List<String> out) {
        if (text == null || text.isEmpty()) {
            out.add("");
            return;
        }

        int i = 0;

        while (i < text.length()) {
            int j = i;

            while (
                    j < text.length() &&
                            fm.stringWidth(text.substring(i, j + 1)) <= maxInnerW
            ) {
                j++;
            }

            if (j == i) {
                j = i + 1;
            }

            out.add(text.substring(i, j));
            i = j;
        }
    }

    private static void configureTextGraphics(Graphics2D g) {
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);
        g.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
    }

    private static Font pickChineseFont(int size) {
        String[] names = {
                "Microsoft YaHei UI",
                "Microsoft YaHei",
                "PingFang SC",
                "Noto Sans CJK SC",
                "SimSun"
        };

        for (String n : names) {
            Font f = new Font(n, Font.PLAIN, size);
            if (f.canDisplay('检') && f.canDisplay('测')) {
                return f;
            }
        }

        return new Font(Font.SANS_SERIF, Font.PLAIN, size);
    }
}