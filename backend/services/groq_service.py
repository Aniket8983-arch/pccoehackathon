import os
import json
from pathlib import Path
from typing import List, Dict, Any

from dotenv import load_dotenv

# Load .env from project root
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(dotenv_path=_PROJECT_ROOT / ".env")

try:
    from groq import Groq
except ImportError:
    Groq = None  # type: ignore


SYSTEM_PROMPT_TEMPLATE = """You are the agricultural intelligence assistant for this crop field.

You must answer using the structured field data supplied by the application.

Never invent crop measurements, soil values, coordinates, weather values, NDVI values, model predictions or disease findings.

Distinguish clearly between:
1. measured data
2. model prediction
3. risk assessment
4. recommendation

If information is unavailable, say that it is unavailable.

Do not turn model confidence into guaranteed probability.

Do not claim a disease is definitively present unless the validated system supports that conclusion.

Use simple language suitable for a farmer.

Explain technical terms when necessary.

When asked why a risk exists, cite the actual evidence supplied by the application.

When asked what to do, provide cautious decision-support guidance and recommend field verification or agricultural expertise when appropriate.

Never fabricate pesticide doses, fertilizer quantities, soil measurements or treatment instructions.

Do not override the trained ML model. Your role is to explain the system's evidence and help the user understand it.

CURRENT FIELD DATA:
{context_json}
"""


class GroqAssistant:
    """Conversational AI assistant powered by Groq."""

    def __init__(self) -> None:
        self.api_key: str = os.getenv("GROQ_API_KEY", "")
        self.model: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        self.client = None
        self.available = False
        
        # Check if Groq is explicitly disabled
        enable_groq = os.getenv("ENABLE_GROQ", "true").lower() == "true"
        if not enable_groq:
            print("[GroqAssistant] Groq is DISABLED via ENABLE_GROQ flag.")
            return

        if Groq is None:
            print("[GroqAssistant] groq SDK not installed.")
            return

        if not self.api_key:
            print("[GroqAssistant] GROQ_API_KEY not set in .env")
            return

        try:
            self.client = Groq(api_key=self.api_key)
            self.available = True
            print(f"[GroqAssistant] Initialized with model={self.model}")
        except Exception as e:
            print(f"[GroqAssistant] Init failed: {e}")

    def chat(
        self,
        message: str,
        analysis_context: Dict[str, Any],
        conversation_history: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        if not self.available or not self.client:
            return {
                "answer": "AI Assistant is temporarily disabled. Crop analysis is available.",
                "evidence": [],
                "map_action": None,
                "confidence_note": "Groq service is disabled.",
                "error": "groq_disabled",
            }

        # Build system prompt with actual data
        context_str = json.dumps(analysis_context, indent=2, default=str) if analysis_context else "{}"
        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(context_json=context_str)

        messages: list[dict] = [{"role": "system", "content": system_prompt}]
        for msg in conversation_history:
            messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", ""),
            })
        messages.append({"role": "user", "content": message})

        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.3,
                max_tokens=1024,
            )
            answer = completion.choices[0].message.content or ""

            return {
                "answer": answer,
                "evidence": [],
                "map_action": None,
                "confidence_note": "Based on actual project data.",
            }
        except Exception as e:
            error_msg = str(e)
            # Don't expose API key in error messages
            if self.api_key and self.api_key in error_msg:
                error_msg = "Groq API request failed."
            return {
                "answer": "I'm having trouble connecting to the AI service right now. Your crop analysis data is still available in the panels above.",
                "evidence": [],
                "map_action": None,
                "confidence_note": None,
                "error": error_msg,
            }


groq_service = GroqAssistant()

