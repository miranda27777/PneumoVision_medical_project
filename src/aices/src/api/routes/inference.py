import json
from typing import List, Optional

from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import JSONResponse

from utils.image_utils import allowed_file
from services.inference_service import predict_with_model, predict_batch_with_model

router = APIRouter()


@router.post("/tasks/predict")
async def predict_task(
    imageId: int = Form(...),
    modelId: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        if not file.filename:
            return JSONResponse(
                status_code=200,
                content={
                    "code": 400,
                    "message": "文件名为空",
                    "error": "文件名为空",
                    "data": None
                }
            )

        if not allowed_file(file.filename):
            return JSONResponse(
                status_code=200,
                content={
                    "code": 400,
                    "message": "仅支持 dcm/png/jpg/jpeg 格式文件",
                    "error": "仅支持 dcm/png/jpg/jpeg 格式文件",
                    "data": None
                }
            )

        contents = await file.read()

        pred = predict_with_model(
            model_id=modelId,
            file_bytes=contents,
            filename=file.filename
        )

        return {
            "code": 200,
            "message": "推理成功",
            "error": None,
            "data": {
                "imageId": imageId,
                "modelId": modelId,
                "predClass": pred["predClass"],
                "predLabel": pred["predLabel"],
                "results": pred["results"]
            }
        }

    except Exception as e:
        return JSONResponse(
            status_code=200,
            content={
                "code": 500,
                "message": "推理失败",
                "error": str(e),
                "data": None
            }
        )


@router.post("/tasks/batch-predict")
async def batch_predict_task(
    modelId: str = Form(...),
    files: List[UploadFile] = File(...),
    imageIds: Optional[str] = Form(None)
):
    try:
        if not files:
            return JSONResponse(
                status_code=200,
                content={
                    "code": 400,
                    "message": "至少需要上传一个文件",
                    "error": "至少需要上传一个文件",
                    "data": None
                }
            )

        valid_files = []
        invalid_names = []

        for file in files:
            if not file.filename or not allowed_file(file.filename):
                invalid_names.append(file.filename or "unknown")
            else:
                valid_files.append(file)

        if invalid_names:
            msg = f"以下文件格式不支持: {', '.join(invalid_names)}"
            return JSONResponse(
                status_code=200,
                content={
                    "code": 400,
                    "message": msg,
                    "error": msg,
                    "data": None
                }
            )

        parsed_ids: List[int] = []
        if imageIds:
            try:
                parsed = json.loads(imageIds)
                if isinstance(parsed, list):
                    parsed_ids = [int(x) for x in parsed]
                else:
                    return JSONResponse(
                        status_code=200,
                        content={
                            "code": 400,
                            "message": "imageIds 必须是 JSON 数组字符串",
                            "error": "imageIds 必须是 JSON 数组字符串",
                            "data": None
                        }
                    )
            except Exception:
                return JSONResponse(
                    status_code=200,
                    content={
                        "code": 400,
                        "message": "imageIds 解析失败，请传如 [1,2,3] 的 JSON 数组字符串",
                        "error": "imageIds 解析失败，请传如 [1,2,3] 的 JSON 数组字符串",
                        "data": None
                    }
                )

        if parsed_ids and len(parsed_ids) != len(valid_files):
            return JSONResponse(
                status_code=200,
                content={
                    "code": 400,
                    "message": "imageIds 数量必须与 files 数量一致",
                    "error": "imageIds 数量必须与 files 数量一致",
                    "data": None
                }
            )

        file_items = []
        for idx, file in enumerate(valid_files):
            contents = await file.read()
            file_items.append({
                "imageId": parsed_ids[idx] if parsed_ids else idx + 1,
                "filename": file.filename,
                "bytes": contents
            })

        batch_result = predict_batch_with_model(
            model_id=modelId,
            files=file_items
        )

        return {
            "code": 200,
            "message": "批量推理成功",
            "error": None,
            "data": {
                "modelId": modelId,
                "total": batch_result["total"],
                "success": batch_result["success"],
                "failed": batch_result["failed"],
                "results": batch_result["results"]
            }
        }

    except Exception as e:
        return JSONResponse(
            status_code=200,
            content={
                "code": 500,
                "message": "批量推理失败",
                "error": str(e),
                "data": None
            }
        )