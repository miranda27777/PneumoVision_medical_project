import threading
import yaml
from typing import Dict, Any

from core.config import MODEL_CONFIG_PATH
from engines.yolo_engine import YOLOEngine
from engines.rtdetr_engine import RTDETREngine


class ModelRegistry:
    def __init__(self):
        self._lock = threading.Lock()
        self._model_cache = {}
        self._configs = self._load_configs()

    def _load_configs(self) -> Dict[str, Any]:
        if not MODEL_CONFIG_PATH.exists():
            return {"models": {}}

        with open(MODEL_CONFIG_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        if "models" not in data:
            data["models"] = {}
        return data

    def reload(self):
        with self._lock:
            self._configs = self._load_configs()
            self._model_cache.clear()

    def save(self):
        with open(MODEL_CONFIG_PATH, "w", encoding="utf-8") as f:
            yaml.safe_dump(self._configs, f, allow_unicode=True, sort_keys=False)

    def list_models(self) -> Dict[str, Any]:
        return self._configs.get("models", {})

    def get_model_config(self, model_id: str) -> Dict[str, Any]:
        models = self._configs.get("models", {})
        if model_id not in models:
            raise ValueError(f"模型不存在: {model_id}")
        return models[model_id]

    def update_model_params(self, model_id: str, params: Dict[str, Any]):
        cfg = self.get_model_config(model_id)
        cfg.setdefault("params", {}).update(params)
        self.save()

    def set_enabled(self, model_id: str, enabled: bool):
        cfg = self.get_model_config(model_id)
        cfg["enabled"] = enabled
        self.save()

    def get_engine(self, model_id: str):
        cfg = self.get_model_config(model_id)

        if not cfg.get("enabled", True):
            raise ValueError(f"模型已禁用: {model_id}")

        with self._lock:
            if model_id in self._model_cache:
                return self._model_cache[model_id]

            model_type = cfg["type"].lower()
            model_path = cfg["path"]

            if model_type == "yolo":
                engine = YOLOEngine(model_path)
            elif model_type == "rtdetr":
                engine = RTDETREngine(model_path)
            else:
                raise ValueError(f"不支持的模型类型: {model_type}")

            self._model_cache[model_id] = engine
            return engine


registry = ModelRegistry()