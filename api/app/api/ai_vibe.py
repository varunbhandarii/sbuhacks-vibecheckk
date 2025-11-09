# app/api/ai_vibe.py
from typing import List, Optional, Dict
import google.generativeai as genai
from app.core.config import settings
from app.api.ai_tools import generate_vibe_question_tool

_MODEL = None

def _ensure_model():
    """Lazy init just for the vibe question tool."""
    global _MODEL
    if _MODEL is None:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _MODEL = genai.GenerativeModel(
            model_name="models/gemini-flash-latest",
            tools=[{"function_declarations": [generate_vibe_question_tool]}],
        )

def _extract_first_function_call(resp):
    try:
        parts = []
        if hasattr(resp, "candidates") and resp.candidates:
            parts.extend(resp.candidates[0].content.parts or [])
        if hasattr(resp, "parts") and resp.parts:
            parts.extend(resp.parts or [])
        for p in parts:
            fc = getattr(p, "function_call", None)
            if fc and getattr(fc, "name", None):
                return fc
    except Exception:
        pass
    return None

def get_contextual_question_from_gemini(event_title: str, event_tags: List[str]) -> Optional[Dict[str, object]]:
    """
    Returns: {"question": str, "options": [str, str, str]} or None
    """
    try:
        _ensure_model()
    except Exception as e:
        print(f"⚠️ VIBE model init failed: {e}")
        return None

    tags_str = ", ".join([t for t in (event_tags or []) if isinstance(t, str)]) or "general"
    prompt = f"""Generate one contextual vibe check question for the following event.
Event Title: {event_title}
Tags: {tags_str}

Based only on the tags, choose the single best category:
- Athletics/Sports (sports, athletics, game): ask about the energy.
- Food (free food, pizza, food): ask how much food is left.
- Workshop/Talk (tech talk, workshop, lecture): ask about seating.
- Social/Mixer (social, mixer, party): ask how easy it is to socialize.

If no category matches, create a generic question about the crowd level.

You MUST call the `generate_vibe_question` function with your answer.
"""

    try:
        chat = _MODEL.start_chat()
        resp = chat.send_message(prompt)
        fc = _extract_first_function_call(resp)
        if fc and getattr(fc, "name", "") == "generate_vibe_question":
            args = dict(getattr(fc, "args", {}) or {})
            q = args.get("question")
            o1, o2, o3 = args.get("option_1"), args.get("option_2"), args.get("option_3")
            if q and o1 and o2 and o3:
                return {"question": q, "options": [o1, o2, o3]}
    except Exception as e:
        print(f"⚠️ VIBE question generation failed: {e}")
    return None
