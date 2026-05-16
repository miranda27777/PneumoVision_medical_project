from typing import Dict, Any, List
from ultralytics import YOLO

from engines.base_engine import BaseEngine
from core.config import PNEUMONIA_LABEL, NORMAL_LABEL, IMAGE_SIZE
from utils.image_utils import preprocess_image_from_bytes
from utils.box_utils import reverse_scale_box, keep_non_overlapping_topk


class YOLOEngine(BaseEngine):
    def load_model(self):
        return YOLO(self.model_path)

    def _predict_core(
        self,
        file_bytes: bytes,
        filename: str,
        params: Dict[str, Any],
        image_id: int | None = None
    ) -> Dict[str, Any]:
        conf = float(params["conf"])
        iou = float(params["iou"])
        max_det = int(params["max_det"])
        top_k = int(params["top_k"])

        try:
            input_img, scale_x, scale_y, orig_w, orig_h = preprocess_image_from_bytes(
                file_bytes=file_bytes,
                filename=filename,
                img_size=IMAGE_SIZE
            )

            results = self.model.predict(
                source=input_img,
                imgsz=IMAGE_SIZE,
                conf=conf,
                iou=iou,
                max_det=max_det,
                save=False,
                verbose=False
            )

            result = results[0]
            boxes = result.boxes

            if boxes is None or len(boxes) == 0:
                return {
                    "imageId": image_id,
                    "filename": filename,
                    "predClass": 0,
                    "predLabel": NORMAL_LABEL,
                    "results": [],
                    "status": "success",
                    "error": None
                }

            xyxy = boxes.xyxy.cpu().numpy()
            confs = boxes.conf.cpu().numpy()

            output_results: List[Dict[str, Any]] = []
            for i in range(len(xyxy)):
                x1, y1, x2, y2 = xyxy[i]
                box_dict = reverse_scale_box(
                    x1=float(x1),
                    y1=float(y1),
                    x2=float(x2),
                    y2=float(y2),
                    scale_x=scale_x,
                    scale_y=scale_y,
                    orig_w=orig_w,
                    orig_h=orig_h
                )

                output_results.append({
                    "label": PNEUMONIA_LABEL,
                    "score": round(float(confs[i]), 6),
                    "x": box_dict["x"],
                    "y": box_dict["y"],
                    "width": box_dict["width"],
                    "height": box_dict["height"],
                    "maskPath": None
                })

            output_results = keep_non_overlapping_topk(output_results, top_k)

            return {
                "imageId": image_id,
                "filename": filename,
                "predClass": 1,
                "predLabel": PNEUMONIA_LABEL,
                "results": output_results,
                "status": "success",
                "error": None
            }

        except Exception as e:
            return {
                "imageId": image_id,
                "filename": filename,
                "predClass": -1,
                "predLabel": "error",
                "results": [],
                "status": "failed",
                "error": str(e)
            }

    def predict(
        self,
        file_bytes: bytes,
        filename: str,
        params: Dict[str, Any]
    ) -> Dict[str, Any]:
        result = self._predict_core(
            file_bytes=file_bytes,
            filename=filename,
            params=params,
            image_id=None
        )
        return {
            "predClass": result["predClass"],
            "predLabel": result["predLabel"],
            "results": result["results"]
        }

    def batch_predict(
        self,
        files: List[Dict[str, Any]],
        params: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []

        for item in files:
            results.append(
                self._predict_core(
                    file_bytes=item["bytes"],
                    filename=item["filename"],
                    params=params,
                    image_id=item["imageId"]
                )
            )

        results.sort(key=lambda x: x.get("imageId", 0))
        return results