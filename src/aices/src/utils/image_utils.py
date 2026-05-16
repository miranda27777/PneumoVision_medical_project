import io
import cv2
import numpy as np
import pydicom
from typing import Tuple

from core.config import ALLOWED_EXTENSIONS


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def load_dcm_gray_from_bytes(file_bytes: bytes) -> np.ndarray:
    ds = pydicom.dcmread(io.BytesIO(file_bytes))
    img = ds.pixel_array.astype(np.float32)

    if getattr(ds, "PhotometricInterpretation", "") == "MONOCHROME1":
        img = img.max() - img

    img = img - img.min()
    max_val = img.max()
    if max_val > 0:
        img = img / max_val
    img = (img * 255).clip(0, 255).astype(np.uint8)
    return img


def load_gray_image_from_bytes(file_bytes: bytes, filename: str) -> np.ndarray:
    ext = filename.rsplit(".", 1)[1].lower()

    if ext == "dcm":
        gray_img = load_dcm_gray_from_bytes(file_bytes)
    else:
        nparr = np.frombuffer(file_bytes, np.uint8)
        gray_img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)

    if gray_img is None:
        raise FileNotFoundError(f"无法读取图片: {filename}")

    return gray_img


def preprocess_image_from_bytes(
    file_bytes: bytes,
    filename: str,
    img_size: int
) -> Tuple[np.ndarray, float, float, int, int]:
    gray_img = load_gray_image_from_bytes(file_bytes, filename)
    orig_h, orig_w = gray_img.shape[:2]

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray_clahe = clahe.apply(gray_img)

    rgb_img = cv2.cvtColor(gray_clahe, cv2.COLOR_GRAY2RGB)
    rgb_img_resized = cv2.resize(rgb_img, (img_size, img_size))

    scale_x = img_size / orig_w
    scale_y = img_size / orig_h

    return rgb_img_resized, scale_x, scale_y, orig_w, orig_h