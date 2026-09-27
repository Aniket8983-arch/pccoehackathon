from typing import Dict, Any, Optional
from datetime import datetime
import uuid

class MultimodalEngine:
    def build_analysis_context(
        self,
        image_prediction: Optional[Dict[str, Any]],
        soil_report: Optional[Dict[str, Any]],
        cell_data: Optional[Dict[str, Any]],
        grid_metadata: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        
        cell = cell_data or {}
        meta = grid_metadata or {}
        
        weather = meta.get("weather", {})
        avg_temp = weather.get("avg_tmax_c", 30)
        rainfall = weather.get("rainfall_mm", 100)
        
        ndvi = cell.get("ndvi_mean", 0)
        
        water_stress = "LOW"
        if rainfall < 50 and avg_temp > 35:
            water_stress = "HIGH"
        elif rainfall < 100:
            water_stress = "MODERATE"
            
        heat_stress = "LOW"
        if avg_temp > 38:
            heat_stress = "HIGH"
        elif avg_temp > 35:
            heat_stress = "MODERATE"
            
        disease_stress = "LOW"
        if image_prediction and image_prediction.get("prediction", {}).get("disease_prob", 0) > 0.7:
            disease_stress = "HIGH"
            
        nutrient_stress = "LOW"
        if soil_report:
            params = soil_report.get("parameters", {})
            for k, v in params.items():
                if v and v.get("status") in ["Low", "Deficient"]:
                    nutrient_stress = "MODERATE"
                    if k in ["nitrogen", "phosphorus"]:
                        nutrient_stress = "HIGH"
        
        return {
            "analysis_id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow().isoformat(),
            "farm": {
                "location": meta.get("location", "Unknown"),
                "aoi_bbox": meta.get("aoi_bbox_4326", []),
                "sentinel_date": meta.get("scene_date", "")
            },
            "cell": {
                "cell_id": cell.get("id", ""),
                "lat": cell.get("lat", 0),
                "lon": cell.get("lon", 0),
                "ndvi_mean": ndvi,
                "elevation_m": cell.get("elevation_m", 0),
                "slope_deg": cell.get("slope_deg", 0)
            },
            "image_prediction": image_prediction or {},
            "soil_report": soil_report or {},
            "ndvi_context": {
                "current": ndvi,
                "field_average": meta.get("ndvi_mean", 0),
                "status": "Below average" if ndvi < meta.get("ndvi_mean", 0) else "Normal"
            },
            "weather": weather,
            "stress_assessment": {
                "disease": {"level": disease_stress, "confidence": 0.8},
                "water": {"level": water_stress, "confidence": 0.7},
                "heat": {"level": heat_stress, "confidence": 0.7},
                "nutrient": {"level": nutrient_stress, "confidence": 0.8},
                "pest": {"level": "LOW", "confidence": 0.5}
            },
            "recommendations": ["Consult agronomist", "Adjust irrigation"]
        }

multimodal_engine = MultimodalEngine()
