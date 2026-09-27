from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
import json
from pathlib import Path
import sys

from backend.services.ml_service import ml_service
from backend.services.soil_parser import soil_parser
from backend.services.multimodal_engine import multimodal_engine

router = APIRouter(prefix="/api/ml", tags=["Machine Learning"])

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

def _load_grid_data():
    grid_path = PROJECT_ROOT / "data" / "processed" / "grid.json"
    if grid_path.exists():
        try:
            return json.loads(grid_path.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}

@router.post("/analyze-image")
async def analyze_image(file: UploadFile = File(...), cell_id: str = Form(None)):
    try:
        contents = await file.read()
        result = ml_service.analyze_image(contents, file.filename)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        # Water and heat stress are now computed per-image inside inference.py
        # using actual leaf pixel color analysis (green ratio, brown index, etc.)
        # No static overrides needed here.
        
        return JSONResponse(content=result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-soil")
async def analyze_soil(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        result = soil_parser.parse_report(contents, file.filename)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return JSONResponse(content=result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze")
async def full_analysis(payload: dict):
    try:
        image_result = payload.get("image_result")
        soil_result = payload.get("soil_result")
        cell_id = payload.get("cell_id")
        
        grid_data = _load_grid_data()
        cells = grid_data.get("cells", [])
        meta = grid_data.get("metadata", {})
        
        cell_data = None
        if cell_id:
            for c in cells:
                if c.get("cell_id") == cell_id:
                    cell_data = c
                    break
                    
        result = multimodal_engine.build_analysis_context(
            image_prediction=image_result,
            soil_report=soil_result,
            cell_data=cell_data,
            grid_metadata=meta
        )
        
        # We need a way to store it for the chat route, but simple in-memory is enough for now
        from backend.routes.assistant_routes import analysis_store
        analysis_store[result["analysis_id"]] = result
        
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/model-status")
async def model_status():
    return JSONResponse(content=ml_service.get_model_status())

@router.get("/model-metrics")
async def model_metrics():
    # Placeholder for training metrics
    return JSONResponse(content={"metrics": "Not implemented yet"})
