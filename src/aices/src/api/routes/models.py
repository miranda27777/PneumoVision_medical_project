from fastapi import APIRouter
from fastapi.responses import JSONResponse

from services.model_service import (
    list_model_configs,
    update_model_params,
    enable_model,
    disable_model,
)
from api.schemas.model_schema import ModelParamsUpdateRequest

router = APIRouter()


@router.get("")
def get_models():
    try:
        return {
            "code": 200,
            "message": "查询成功",
            "error": None,
            "data": list_model_configs()
        }
    except Exception as e:
        return JSONResponse(
            status_code=200,
            content={
                "code": 500,
                "message": "查询失败",
                "error": str(e),
                "data": None
            }
        )


@router.put("/{model_id}/params")
def update_params(
    model_id: str,
    payload: ModelParamsUpdateRequest
):
    try:
        update_dict = payload.model_dump(exclude_none=True)

        if not update_dict:
            return JSONResponse(
                status_code=200,
                content={
                    "code": 400,
                    "message": "至少传一个要更新的参数",
                    "error": "至少传一个要更新的参数",
                    "data": None
                }
            )

        update_model_params(model_id, update_dict)
        return {
            "code": 200,
            "message": "参数更新成功",
            "error": None,
            "data": None
        }
    except Exception as e:
        return JSONResponse(
            status_code=200,
            content={
                "code": 400,
                "message": "参数更新失败",
                "error": str(e),
                "data": None
            }
        )


@router.put("/{model_id}/enable")
def enable(model_id: str):
    try:
        enable_model(model_id)
        return {
            "code": 200,
            "message": "模型启用成功",
            "error": None,
            "data": None
        }
    except Exception as e:
        return JSONResponse(
            status_code=200,
            content={
                "code": 400,
                "message": "模型启用失败",
                "error": str(e),
                "data": None
            }
        )


@router.put("/{model_id}/disable")
def disable(model_id: str):
    try:
        disable_model(model_id)
        return {
            "code": 200,
            "message": "模型禁用成功",
            "error": None,
            "data": None
        }
    except Exception as e:
        return JSONResponse(
            status_code=200,
            content={
                "code": 400,
                "message": "模型禁用失败",
                "error": str(e),
                "data": None
            }
        )