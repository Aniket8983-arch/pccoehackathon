import io
import re
import pandas as pd
from typing import Dict, Any, Optional
import fitz

class SoilParser:
    def __init__(self):
        self.ref_ranges = {
            "pH": {"range": "6.5-7.5", "eval": lambda x: "Neutral" if 6.5 <= x <= 7.5 else ("Acidic" if x < 6.5 else "Alkaline")},
            "nitrogen": {"range": "280-560", "eval": lambda x: "Low" if x < 280 else ("High" if x > 560 else "Medium")},
            "phosphorus": {"range": "10-25", "eval": lambda x: "Low" if x < 10 else ("High" if x > 25 else "Medium")},
            "potassium": {"range": "110-280", "eval": lambda x: "Low" if x < 110 else ("High" if x > 280 else "Medium")},
            "organic_carbon": {"range": "0.5-0.75", "eval": lambda x: "Low" if x < 0.5 else ("High" if x > 0.75 else "Medium")},
            "ec": {"range": "<1", "eval": lambda x: "Normal" if x < 1 else ("High" if x > 2 else "Moderate")}
        }
        
        self.patterns = {
            "pH": r"pH[\s:=]+([0-9.]+)",
            "nitrogen": r"(?:Nitrogen|N)[\s:=]+([0-9.]+)",
            "phosphorus": r"(?:Phosphorus|P)[\s:=]+([0-9.]+)",
            "potassium": r"(?:Potassium|K)[\s:=]+([0-9.]+)",
            "organic_carbon": r"(?:Organic Carbon|OC)[\s:=]+([0-9.]+)",
            "ec": r"(?:EC|Electrical Conductivity)[\s:=]+([0-9.]+)"
        }

    def _eval_status(self, key: str, value: float) -> str:
        if key in self.ref_ranges:
            return self.ref_ranges[key]["eval"](value)
        return "Unknown"

    def parse_report(self, file_bytes: bytes, filename: str) -> Dict[str, Any]:
        ext = filename.split(".")[-1].lower() if "." in filename else ""
        text = ""
        method = ""
        
        if ext == "pdf":
            try:
                doc = fitz.open("pdf", file_bytes)
                text = "\n".join([page.get_text() for page in doc])
                method = "pdf_text"
            except Exception as e:
                return {"error": f"Failed to parse PDF: {e}"}
        elif ext in ["csv", "xlsx"]:
            try:
                if ext == "csv":
                    df = pd.read_csv(io.BytesIO(file_bytes))
                else:
                    df = pd.read_excel(io.BytesIO(file_bytes))
                text = df.to_string()
                method = "tabular"
            except Exception as e:
                return {"error": f"Failed to parse tabular file: {e}"}
        elif ext in ["jpg", "jpeg", "png"]:
            return {"error": "OCR not available for images, please upload PDF or CSV"}
        else:
            return {"error": f"Unsupported file type: {ext}"}
            
        parameters = {}
        for key, pattern in self.patterns.items():
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    val = float(match.group(1))
                    parameters[key] = {
                        "value": val,
                        "unit": "",
                        "status": self._eval_status(key, val),
                        "reference_range": self.ref_ranges[key]["range"] if key in self.ref_ranges else ""
                    }
                except ValueError:
                    parameters[key] = None
            else:
                parameters[key] = None

        return {
            "parameters": parameters,
            "raw_text": text[:500] + "..." if len(text) > 500 else text,
            "extraction_method": method,
            "confidence": "high" if method else "low"
        }

soil_parser = SoilParser()
