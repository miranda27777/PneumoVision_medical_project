from fastapi import FastAPI

from api.routes.inference import router as inference_router
from api.routes.models import router as models_router
from api.routes.dicom import router as dicom_router

app = FastAPI(title="PneumoVision Internal Inference Service")

app.include_router(inference_router, prefix="/api/inference", tags=["inference"])
app.include_router(models_router, prefix="/api/models", tags=["models"])
app.include_router(dicom_router, prefix="/api/dicom", tags=["dicom"])