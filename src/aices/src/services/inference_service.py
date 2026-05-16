from typing import Dict, Any, List
from core.registry import registry


def predict_with_model(
        model_id: str,
        file_bytes: bytes,
        filename: str
) -> Dict[str, Any]:
    cfg = registry.get_model_config(model_id)
    params = cfg.get("params", {})
    engine = registry.get_engine(model_id)
    return engine.predict(file_bytes=file_bytes, filename=filename, params=params)


def predict_batch_with_model(
        model_id: str,
        files: List[Dict[str, Any]]
) -> Dict[str, Any]:
    cfg = registry.get_model_config(model_id)
    params = cfg.get("params", {})
    engine = registry.get_engine(model_id)

    results = engine.batch_predict(files=files, params=params)
    success_count = sum(1 for r in results if r["status"] == "success")
    failed_count = len(results) - success_count

    return {
        "total": len(results),
        "success": success_count,
        "failed": failed_count,
        "results": results
    }