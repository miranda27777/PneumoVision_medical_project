from typing import Dict, Any
from core.registry import registry


def list_model_configs():
    return registry.list_models()


def update_model_params(model_id: str, params: Dict[str, Any]):
    allowed_keys = {"conf", "iou", "max_det", "top_k"}
    safe_params = {k: v for k, v in params.items() if k in allowed_keys}

    if not safe_params:
        raise ValueError("至少传一个合法参数")

    registry.update_model_params(model_id, safe_params)
    registry.reload()


def enable_model(model_id: str):
    registry.set_enabled(model_id, True)
    registry.reload()


def disable_model(model_id: str):
    registry.set_enabled(model_id, False)
    registry.reload()