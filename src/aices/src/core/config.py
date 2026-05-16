from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_CONFIG_PATH = BASE_DIR / "configs" / "models.yaml"

ALLOWED_EXTENSIONS = {"dcm", "png", "jpg", "jpeg"}
PNEUMONIA_LABEL = "pneumonia"
NORMAL_LABEL = "normal"
IMAGE_SIZE = 512