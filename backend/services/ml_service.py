import sys
from pathlib import Path
import io
from typing import Any, Dict, Optional

from PIL import Image, ImageStat

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

MODELS_DIR = PROJECT_ROOT / "ml" / "models"


class MLService:
    """Singleton ML inference service for crop image analysis."""
    _instance: Optional["MLService"] = None

    def __new__(cls) -> "MLService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._init_models()
        return cls._instance

    def _init_models(self) -> None:
        self.models_loaded = False
        self.tomato_model = None
        self.tomato_classes: dict = {}
        self.tomato_transform = None
        self.maize_model = None
        self.maize_classes: dict = {}
        self.maize_transform = None
        self.metrics: Dict[str, Any] = {}

        try:
            from ml.inference import load_tomato_model, load_maize_model

            tomato_pth = MODELS_DIR / "tomato_disease_efficientnet.pth"
            tomato_cls = MODELS_DIR / "tomato_classes.json"
            maize_pth = MODELS_DIR / "maize_leaf_cnn.pth"
            maize_cls = MODELS_DIR / "maize_classes.json"

            if tomato_pth.exists() and tomato_cls.exists():
                self.tomato_model, self.tomato_classes, self.tomato_transform = (
                    load_tomato_model(str(tomato_pth), str(tomato_cls))
                )
                print("[MLService] Tomato model loaded.")
            else:
                print(f"[MLService] Tomato model not found at {tomato_pth}")

            if maize_pth.exists() and maize_cls.exists():
                self.maize_model, self.maize_classes, self.maize_transform = (
                    load_maize_model(str(maize_pth), str(maize_cls))
                )
                print("[MLService] Maize model loaded.")
            else:
                print(f"[MLService] Maize model not found at {maize_pth}")

            self.models_loaded = self.tomato_model is not None or self.maize_model is not None
            self.metrics = {
                "tomato": {"status": "loaded" if self.tomato_model else "not_found"},
                "maize": {"status": "loaded" if self.maize_model else "not_found"},
            }

            # Load training metrics if available
            tomato_metrics_path = MODELS_DIR / "tomato_metrics.json"
            maize_metrics_path = MODELS_DIR / "maize_metrics.json"
            import json
            if tomato_metrics_path.exists():
                self.metrics["tomato"]["training"] = json.loads(tomato_metrics_path.read_text())
            if maize_metrics_path.exists():
                self.metrics["maize"]["training"] = json.loads(maize_metrics_path.read_text())

        except Exception as e:
            print(f"[MLService] Failed to load ML models: {e}")

    def get_model_status(self) -> Dict[str, Any]:
        return {"loaded": self.models_loaded, "metrics": self.metrics}

    def analyze_image(self, image_bytes: bytes, filename: str) -> Dict[str, Any]:
        # --- Validation ---
        if len(image_bytes) > 10 * 1024 * 1024:
            return {"error": "Image too large. Maximum 10MB."}

        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in ("jpg", "jpeg", "png", "webp"):
            return {"error": "Invalid image type. Supported: jpg, jpeg, png, webp."}

        try:
            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        except Exception as e:
            return {"error": f"Cannot open image: {e}"}

        w, h = img.size
        if w < 32 or h < 32:
            return {"error": "Image too small. Minimum 32×32 pixels."}

        # Quality checks
        warnings: list[str] = []
        try:
            stat = ImageStat.Stat(img)
            brightness = sum(stat.mean) / len(stat.mean)
            if brightness < 20:
                warnings.append("Image appears very dark — predictions may be inaccurate.")
            elif brightness > 240:
                warnings.append("Image appears overexposed — predictions may be inaccurate.")
        except Exception:
            pass

        # --- Inference ---
        if not self.models_loaded:
            return {
                "error": "ML models are not loaded yet. Please train models first.",
                "hint": "Run: python ml/train_tomato.py",
            }

        try:
            from ml.inference import predict_tomato

            if self.tomato_model is None:
                return {"error": "Tomato model not available."}

            prediction = predict_tomato(
                self.tomato_model, img, self.tomato_transform, self.tomato_classes
            )
            prediction["warnings"] = warnings
            prediction["image_info"] = {"filename": filename, "width": w, "height": h}
            return prediction

        except Exception as e:
            return {"error": f"Inference failed: {e}"}


# Module-level singleton
ml_service = MLService()
