import google.generativeai as genai
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import pytz
from app.dependencies import get_db
from app.schemas import AIQueryRequest, AIQueryResponse, EventPublic
from app.core.config import settings
from app.api.ai_tools import get_events_tool, get_events_from_db
from app.api.ai_system_instructions import VIBECHECK_SYSTEM_INSTRUCTIONS

from app.api.ai_tools import generate_vibe_question_tool
from typing import List

router = APIRouter()

# --- Initialize Gemini with system instructions ---
try:
    genai.configure(api_key=settings.GEMINI_API_KEY)
    
    # Use Gemini 1.5 Flash (more reliable for function calling)
    gemini_model = genai.GenerativeModel(
        model_name="models/gemini-flash-latest",
        tools=[{"function_declarations": [get_events_tool]}],
        system_instruction=VIBECHECK_SYSTEM_INSTRUCTIONS,
    )
    print("✅ Gemini model initialized successfully")
    print(f"   Model: gemini-2.5-flash-latest")
    print(f"   Tools: {len([get_events_tool])} function(s)")
except Exception as e:
    print(f"❌ CRITICAL: Failed to initialize Gemini: {e}")
    gemini_model = None
    
# --- NEW: Initialize Gemini Question Generation Model ---
try:
    # This model is *only* for generating questions. It has a different tool.
    vibe_question_model = genai.GenerativeModel(
        model_name="models/gemini-flash-latest",
        tools=[{"function_declarations": [generate_vibe_question_tool]}]
    )
    print("✅ Gemini VIBE QUESTION model initialized successfully")
except Exception as e:
    print(f"❌ CRITICAL: Failed to initialize Gemini VIBE QUESTION model: {e}")
    vibe_question_model = None


# --- NEW: Helper Function to Call the Question Tool ---
def get_contextual_question_from_gemini(event_title: str, event_tags: List[str]) -> dict:
    """
    Calls Gemini to generate a contextual question for an event.
    Returns a dict: {"question": "...", "options": ["...", "...", "..."]}
    """
    if not vibe_question_model:
        print("⚠️ WARNING: Vibe question model not initialized. Skipping generation.")
        return None

    # 1. Create the prompt
    prompt = f"""
    Generate one contextual vibe check question for the following event.
    Event Title: {event_title}
    Tags: {', '.join(event_tags)}

    Based *only on the tags*, choose the *single best* question category from the following examples:
    - Athletics/Sports (e.g., 'sports', 'athletics', 'game'): Ask about the energy.
    - Food (e.g., 'free food', 'pizza', 'food'): Ask how much food is left.
    - Workshop/Talk (e.g., 'tech talk', 'workshop', 'lecture'): Ask about seating.
    - Social/Mixer (e.g., 'social', 'mixer', 'party'): Ask how easy it is to socialize.
    
    If no category matches, create a generic question about the crowd level.
    
    You MUST call the `generate_vibe_question` function with your answer.
    """
    
    try:
        # 2. Send prompt to Gemini
        chat = vibe_question_model.start_chat()
        response = chat.send_message(prompt)
        
        # 3. Extract the function call
        function_call = _extract_first_function_call(response)
        
        if function_call and function_call.name == "generate_vibe_question":
            args = dict(function_call.args)
            return {
                "question": args.get("question"),
                "options": [
                    args.get("option_1"),
                    args.get("option_2"),
                    args.get("option_3")
                ]
            }
        else:
            print(f"⚠️ WARNING: Gemini failed to call function for question gen. Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ ERROR in get_contextual_question_from_gemini: {e}")
        return None


def _extract_first_function_call(resp):
    """Handle differences across SDK/builds to find the first function call."""
    # Search candidates/parts safely and return the first non-empty function call
    try:
        parts = []
        if hasattr(resp, "candidates") and resp.candidates:
            parts.extend((resp.candidates[0].content.parts or []))
        if hasattr(resp, "parts") and resp.parts:
            parts.extend(resp.parts or [])
        for p in parts:
            fc = getattr(p, "function_call", None)
            if fc and getattr(fc, "name", None):
                return fc
    except Exception:
        pass
    return None


def _extract_first_text(resp) -> str:
    """Extract text response from Gemini."""
    try:
        # Try to get text directly
        if hasattr(resp, 'text') and resp.text:
            return resp.text
    except Exception:
        pass
    
    try:
        # Try to get from candidates
        if hasattr(resp, 'candidates') and resp.candidates:
            for part in resp.candidates[0].content.parts:
                if hasattr(part, 'text') and part.text:
                    return part.text
    except Exception:
        pass
    
    try:
        # Try to get from parts directly
        if hasattr(resp, 'parts') and resp.parts:
            for part in resp.parts:
                if hasattr(part, 'text') and part.text:
                    return part.text
    except Exception:
        pass
    
    return ""


def _build_chat_history(conversation_history):
    """Convert frontend conversation history to Gemini's expected format."""
    chat_history = []
    
    for msg in conversation_history:
        role = "model" if msg.role == "bot" else "user"
        chat_history.append({
            "role": role,
            "parts": [{"text": msg.content}]
        })
    
    return chat_history


def _convert_event_to_simple_dict(event):
    """Convert an Event ORM object to a simple dictionary."""
    return {
        "id": str(event.id),
        "title": event.title,
        "description": event.description or "",
        "start_time": event.start_time.isoformat() if event.start_time else None,
        "end_time": event.end_time.isoformat() if event.end_time else None,
        "location_name": event.location_name or "",
        "tags": event.tags or [],
        "image_url": event.image_url or ""
    }


@router.post("/query", response_model=AIQueryResponse)
def post_ai_query(
    query: AIQueryRequest,
    db: Session = Depends(get_db)
):
    """
    Handles a user's natural language query using Gemini.
    """
    if not gemini_model:
        raise HTTPException(
            status_code=503, 
            detail="AI service is not configured. Please check GEMINI_API_KEY."
        )

    print(f"\n{'='*80}")
    print(f"📨 NEW AI QUERY")
    print(f"{'='*80}")
    print(f"Query: '{query.text}'")
    print(f"History: {len(query.conversation_history or [])} messages")

    # 1) Add current date/time context
    sbu_tz = pytz.timezone("America/New_York")
    now = datetime.now(sbu_tz)
    current_time_str = now.strftime("%A, %B %d, %Y at %I:%M %p %Z")
    contextual_query = f"[Current time: {current_time_str}]\n\n{query.text}"
    print(f"⏰ Time context: {current_time_str}")
    
    # 2) Build conversation history
    history = _build_chat_history(query.conversation_history or [])
    print(f"📜 Built chat history with {len(history)} messages")
    
    # 3) Start chat with history
    try:
        chat = gemini_model.start_chat(history=history)
        print(f"✅ Chat session started")
    except Exception as e:
        print(f"❌ Failed to start chat: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to start chat: {e}"
        )
    
    # 4) Send message and get first response
    try:
        print(f"\n🤖 Sending message to Gemini...")
        print(f"   Message: {contextual_query[:100]}...")
        response = chat.send_message(contextual_query)
        print(f"✅ Got initial response from Gemini")
        
        # Debug: Print response structure
        if hasattr(response, 'candidates') and response.candidates:
            parts = response.candidates[0].content.parts
            print(f"   Response has {len(parts)} part(s):")
            for i, part in enumerate(parts):
                if hasattr(part, 'function_call'):
                    fc = part.function_call
                    print(f"      Part {i}: FUNCTION_CALL")
                    fname = getattr(fc, "name", "(unknown)")
                    # fc.args can be None → make this print safe
                    try:
                        args_preview = dict(getattr(fc, "args", {}) or {})
                    except Exception:
                        args_preview = {}
                    print(f"         Function: {fname}")
                    print(f"         Args: {args_preview}")
                elif hasattr(part, 'text'):
                    text_preview = part.text[:100] if part.text else "(empty)"
                    print(f"      Part {i}: TEXT - {len(part.text or '')} chars")
                    print(f"         Preview: {text_preview}")
        else:
            print(f"   ⚠️ Response has no candidates")
                    
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"❌ Gemini error: {error_details}")
        raise HTTPException(
            status_code=500, 
            detail=f"Gemini error: {str(e)}"
        )

    # 5) Check if Gemini called the tool
    function_call = _extract_first_function_call(response)
    
    if function_call and getattr(function_call, "name", "") == "get_events":
        print(f"\n{'='*80}")
        print(f"🔧 TOOL CALL DETECTED: get_events")
        print(f"{'='*80}")
        
        # Extract arguments
        args = dict(getattr(function_call, "args", {}) or {})
        print(f"📋 Tool arguments:")
        print(f"   Tags: {args.get('tags')}")
        print(f"   Time Range: {args.get('time_range')}")
        
        # Validate parameters - ensure at least one is provided
        if not args.get("tags") and not args.get("time_range"):
            print(f"⚠️ WARNING: No parameters provided - defaulting to this_week")
            args["time_range"] = "this_week"
        
        # 6) Execute database query
        try:
            print(f"\n🗄️ Executing database query...")
            events = get_events_from_db(
                db=db,
                tags=args.get("tags"),
                time_range=args.get("time_range"),
            )
            print(f"✅ Database query completed")
            print(f"   Found: {len(events)} events")
        except Exception as e:
            print(f"❌ Database error: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(
                status_code=500,
                detail=f"Database error: {str(e)}"
            )
        
        # 7) Convert events to dictionaries
        try:
            print(f"\n🔄 Converting events...")
            events_for_gemini = [_convert_event_to_simple_dict(e) for e in events]
            events_public = [
                EventPublic.model_validate(e, from_attributes=True) for e in events
            ]
            print(f"✅ Converted {len(events_public)} events for response")
            
            # Debug: Show first event
            if events_for_gemini:
                print(f"\n   Sample event for Gemini:")
                sample = events_for_gemini[0]
                print(f"      Title: {sample['title']}")
                print(f"      Time: {sample['start_time']}")
                print(f"      Location: {sample['location_name']}")
                print(f"      Tags: {sample['tags']}")
            else:
                print(f"   ⚠️ No events to send back to Gemini")
                
        except Exception as e:
            print(f"❌ Conversion error: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(
                status_code=500,
                detail=f"Conversion error: {str(e)}"
            )
        
        # 8) Send function response back to Gemini
        try:
            print(f"\n🤖 Sending function response back to Gemini...")
            print(f"   Sending {len(events_for_gemini)} events")
            
            function_response_message = {
                "function_response": {
                    "name": "get_events",
                    "response": {"events": events_for_gemini}
                }
            }
            
            response_2 = chat.send_message(function_response_message)
            print(f"✅ Got final response from Gemini")
            
            final_text = _extract_first_text(response_2)
            print(f"   Response length: {len(final_text)} chars")
            
            if not final_text:
                print(f"⚠️ WARNING: Empty text response from Gemini")
                if len(events) == 0:
                    final_text = "I couldn't find any events matching your criteria. Want to try a different time range or category?"
                else:
                    final_text = f"I found {len(events)} events for you! Check them out below."
            
            print(f"   Final response preview: {final_text[:150]}...")
            print(f"\n{'='*80}")
            print(f"✅ REQUEST COMPLETE")
            print(f"{'='*80}\n")
            
            return AIQueryResponse(
                text_response=final_text,
                events=events_public
            )
            
        except Exception as e:
            print(f"❌ Error sending function response: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(
                status_code=500, 
                detail=f"Function response error: {str(e)}"
            )
    
    # No tool call - direct text response
    print(f"\n{'='*80}")
    print(f"💬 DIRECT TEXT RESPONSE (No tool call)")
    print(f"{'='*80}")
    final_text = _extract_first_text(response)
    
    if not final_text:
        print(f"⚠️ WARNING: Empty response from Gemini")
        final_text = "I'm not sure how to help with that. Try asking about campus events!"
    
    print(f"   Response: {final_text[:150]}...")
    print(f"{'='*80}\n")
    
    return AIQueryResponse(
        text_response=final_text,
        events=[]
    )