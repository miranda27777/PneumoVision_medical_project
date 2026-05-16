from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional


class BaseEngine(ABC):
    def __init__(self, model_path: str):
        self.model_path = model_path
        self.model = self.load_model()

    @abstractmethod
    def load_model(self):
        pass

    @abstractmethod
    def predict(
        self,
        file_bytes: bytes,
        filename: str,
        params: Dict[str, Any]
    ) -> Dict[str, Any]:
        pass

    @abstractmethod
    def batch_predict(
        self,
        files: List[Dict[str, Any]],
        params: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        pass