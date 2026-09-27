from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Optional, Any

from backend.services.groq_service import groq_service

router = APIRouter(prefix="/api/assistant", tags=["Assistant"])

analysis_store: Dict[str, Any] = {}

class ChatRequest(BaseModel):
    message: str
    analysis_id: Optional[str] = None
    cell_id: Optional[str] = None
    conversation_history: List[Dict[str, str]] = []

@router.post("/chat")
async def chat(request: ChatRequest):
    context = {}
    if request.analysis_id and request.analysis_id in analysis_store:
        context = analysis_store[request.analysis_id]
        
    result = groq_service.chat(
        message=request.message,
        analysis_context=context,
        conversation_history=request.conversation_history
    )
    
    if "error" in result and result["error"] not in ["groq_disabled", "groq_unavailable"]:
        raise HTTPException(status_code=500, detail=result["error"])
        
    return JSONResponse(content=result)

@router.get("/context")
async def get_context(analysis_id: Optional[str] = None, cell_id: Optional[str] = None):
    if analysis_id and analysis_id in analysis_store:
        return JSONResponse(content=analysis_store[analysis_id])
    return JSONResponse(content={"error": "Context not found"}, status_code=404)
