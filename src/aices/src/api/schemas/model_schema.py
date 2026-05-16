from typing import Optional
from pydantic import BaseModel, Field


class ModelParamsUpdateRequest(BaseModel):
    conf: Optional[float] = Field(None, description="置信度阈值", ge=0.0, le=1.0)
    iou: Optional[float] = Field(None, description="NMS IoU 阈值", ge=0.0, le=1.0)
    max_det: Optional[int] = Field(None, description="模型内部最多保留多少个框", ge=1, le=10)
    top_k: Optional[int] = Field(None, description="最终返回前几个框", ge=1, le=10)

    model_config = {
        "json_schema_extra": {
            "example": {
                "conf": 0.45,
                "top_k": 1
            }
        }
    }