from typing import Dict, Any, List


def reverse_scale_box(
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    scale_x: float,
    scale_y: float,
    orig_w: int,
    orig_h: int
) -> Dict[str, float]:
    x1_orig = x1 / scale_x
    y1_orig = y1 / scale_y
    x2_orig = x2 / scale_x
    y2_orig = y2 / scale_y

    x1_orig = max(0.0, min(x1_orig, float(orig_w)))
    y1_orig = max(0.0, min(y1_orig, float(orig_h)))
    x2_orig = max(0.0, min(x2_orig, float(orig_w)))
    y2_orig = max(0.0, min(y2_orig, float(orig_h)))

    if x2_orig < x1_orig:
        x1_orig, x2_orig = x2_orig, x1_orig
    if y2_orig < y1_orig:
        y1_orig, y2_orig = y2_orig, y1_orig

    return {
        "x": round(float(x1_orig), 2),
        "y": round(float(y1_orig), 2),
        "width": round(float(x2_orig - x1_orig), 2),
        "height": round(float(y2_orig - y1_orig), 2),
    }


def boxes_intersect(box1: Dict[str, Any], box2: Dict[str, Any]) -> bool:
    x1_min, y1_min = box1["x"], box1["y"]
    x1_max = box1["x"] + box1["width"]
    y1_max = box1["y"] + box1["height"]

    x2_min, y2_min = box2["x"], box2["y"]
    x2_max = box2["x"] + box2["width"]
    y2_max = box2["y"] + box2["height"]

    inter_w = min(x1_max, x2_max) - max(x1_min, x2_min)
    inter_h = min(y1_max, y2_max) - max(y1_min, y2_min)

    return inter_w > 0 and inter_h > 0


def keep_non_overlapping_topk(
    boxes: List[Dict[str, Any]],
    top_k: int
) -> List[Dict[str, Any]]:
    boxes = sorted(boxes, key=lambda x: x["score"], reverse=True)

    kept = []
    for box in boxes:
        has_overlap = any(boxes_intersect(box, kept_box) for kept_box in kept)
        if not has_overlap:
            kept.append(box)
        if len(kept) >= top_k:
            break

    return kept