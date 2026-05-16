import io
from typing import Optional, Tuple

import numpy as np
import pydicom
from PIL import Image
from pydicom.multival import MultiValue


def _to_float(value, default: Optional[float] = None) -> Optional[float]:
    try:
        if isinstance(value, MultiValue):
            return float(value[0])
        return float(value)
    except Exception:
        return default


def _get_window(ds) -> Tuple[Optional[float], Optional[float]]:
    wc = getattr(ds, "WindowCenter", None)
    ww = getattr(ds, "WindowWidth", None)

    center = _to_float(wc)
    width = _to_float(ww)

    if center is None or width is None or width <= 0:
        return None, None

    return center, width


def _apply_window(arr: np.ndarray, center: float, width: float) -> np.ndarray:
    low = center - width / 2.0
    high = center + width / 2.0
    arr = np.clip(arr, low, high)
    arr = (arr - low) / (high - low)
    arr = arr * 255.0
    return arr.astype(np.uint8)


def _normalize_to_uint8(arr: np.ndarray) -> np.ndarray:
    arr = arr.astype(np.float32)

    lower = np.percentile(arr, 1)
    upper = np.percentile(arr, 99)

    if upper <= lower:
        lower = float(np.min(arr))
        upper = float(np.max(arr))

    if upper <= lower:
        return np.zeros(arr.shape, dtype=np.uint8)

    arr = np.clip(arr, lower, upper)
    arr = (arr - lower) / (upper - lower)
    arr = arr * 255.0

    return arr.astype(np.uint8)


def dicom_bytes_to_png_bytes(dicom_bytes: bytes) -> bytes:
    ds = pydicom.dcmread(io.BytesIO(dicom_bytes), force=True)

    try:
        pixel_array = ds.pixel_array
    except Exception as e:
        raise RuntimeError(
            "DICOM 像素数据解码失败，请确认已安装 pylibjpeg / pylibjpeg-libjpeg / pylibjpeg-openjpeg"
        ) from e

    arr = pixel_array.astype(np.float32)

    slope = float(getattr(ds, "RescaleSlope", 1) or 1)
    intercept = float(getattr(ds, "RescaleIntercept", 0) or 0)
    arr = arr * slope + intercept

    if arr.ndim == 3:
        # 多帧 DICOM：默认取第一帧
        arr = arr[0]

    window_center, window_width = _get_window(ds)

    if window_center is not None and window_width is not None:
        arr8 = _apply_window(arr, window_center, window_width)
    else:
        arr8 = _normalize_to_uint8(arr)

    photometric = str(getattr(ds, "PhotometricInterpretation", "")).upper()

    if photometric == "MONOCHROME1":
        arr8 = 255 - arr8

    image = Image.fromarray(arr8)

    if image.mode != "RGB":
        image = image.convert("RGB")

    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()