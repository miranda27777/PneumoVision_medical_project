from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response

from utils.dicom_utils import dicom_bytes_to_png_bytes

router = APIRouter()


@router.post("/convert-to-png")
async def convert_dicom_to_png(file: UploadFile = File(...)):
    """
    将 DICOM 文件转换为 PNG 图片。

    Spring Boot 会调用这个接口：
    POST /api/dicom/convert-to-png

    Body:
      form-data:
        file: xxx.dcm

    Response:
      image/png
    """
    if file is None:
        raise HTTPException(status_code=400, detail="DICOM 文件不能为空")

    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")

    if not file.filename.lower().endswith(".dcm"):
        raise HTTPException(status_code=400, detail="仅支持 .dcm 文件")

    try:
        dicom_bytes = await file.read()

        if not dicom_bytes:
            raise HTTPException(status_code=400, detail="DICOM 文件内容为空")

        png_bytes = dicom_bytes_to_png_bytes(dicom_bytes)

        return Response(
            content=png_bytes,
            media_type="image/png",
            headers={
                "Content-Disposition": "inline; filename=converted.png"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"DICOM 转 PNG 失败: {str(e)}"
        )