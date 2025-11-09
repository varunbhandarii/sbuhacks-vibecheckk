from sqlalchemy.orm import Session
from app.models import Event
from datetime import datetime, timedelta, time
import pytz
import google.generativeai as genai  # Import Gemini

# Tool declaration (unchanged)
get_events_tool = {
    "name": "get_events",
    "description": "Search for campus events at Stony Brook University. Use this tool whenever a user asks about events, activities, or what's happening on campus.",
    "parameters": {
        "type": "object",
        "properties": {
            "keywords": {
                "type": "string",
                "description": "Search keywords to match against event titles and descriptions. Use multiple related terms separated by spaces for better results. Example: 'AI artificial intelligence machine learning' or 'hackathon coding programming competition'"
            },
            "tags": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Filter events by tags. Available tags: art, ai, sports, fun, music, food, tech, career, wellness, academic, free, social, athletics. Example: ['ai', 'tech'] for AI and tech events."
            },
            "time_range": {
                "type": "string",
                "enum": ["today", "tomorrow", "this_week", "next_week", "this_weekend", "next_weekend"],
                "description": "Filter events by time period. If user asks generally about events without specifying time, use 'this_week'."
            }
        },
        "required": []
    }
}

def get_events_from_db(
    db: Session,
    tags: list[str] | None = None,
    time_range: str | None = None,
    query: str | None = None  # Add the query parameter
) -> list[Event]:
    """
    Query upcoming events with optional tag, time-range, and query-based context matching filters.
    
    Args:
        db: SQLAlchemy database session
        tags: List of tag strings to filter by (e.g., ["ai", "sports"])
        time_range: Time period to filter (e.g., "today", "tomorrow", "this_week")
        query: User's natural language query for context matching
    
    Returns:
        List of Event objects matching the filters
    """
    print(f"\n{'='*60}")
    print(f"🔧 AI Tool: get_events_from_db() called")
    print(f"   📋 Tags: {tags}")
    print(f"   📅 Time Range: {time_range}")
    print(f"   🔍 Query: {query}")
    print(f"{'='*60}")
    
    # Validate that at least one parameter is provided
    if not tags and not time_range and not query:
        print(f"⚠️ ERROR: No parameters provided to get_events_from_db!")
        raise ValueError("Expected 'tags', 'time_range', or 'query' to be specified.")
    
    try:
        # Get current time in SBU timezone (Eastern Time)
        sbu_tz = pytz.timezone("America/New_York")
        now_in_sbu = datetime.now(sbu_tz)
        
        print(f"⏰ Current SBU time: {now_in_sbu.strftime('%Y-%m-%d %H:%M:%S %Z')}")
        
        # Start with base query
        query = db.query(Event)
        
        # Apply time range filters
        if time_range:
            today = now_in_sbu.date()
            
            if time_range == "next_week":
                mon = today - timedelta(days=today.weekday())
                next_mon = mon + timedelta(weeks=1)
                following_mon = next_mon + timedelta(weeks=1)
                start = datetime.combine(next_mon, time.min, tzinfo=sbu_tz)
                end = datetime.combine(following_mon, time.min, tzinfo=sbu_tz)
                query = query.filter(Event.start_time >= start, Event.start_time < end)
                print(f"📅 Filtering for NEXT WEEK: {start.date()} to {end.date()}")
        
        # # Apply tag filters
        # if tags:
        #     tags_lower = [tag.lower() for tag in tags]
        #     query = query.filter(Event.tags.any(func.lower(Event.tags).in_(tags_lower)))
        #     print(f"🏷️  Filtering by tags: {tags}")
        
        # Fetch all events matching the time range and tags
        events = query.all()
        
        # If a query is provided, use Gemini to calculate similarity scores
        if query:
            print(f"🔍 Using Gemini to calculate similarity scores for query: {query}")
            event_descriptions = [event.description or "" for event in events]
            
            # Use Gemini to calculate similarity scores
            gemini_responses = []
            
        
        import os

        similarity_model = genai.GenerativeModel("models/gemini-flash-latest")
        gemini_responses = []

        # Prepare log files
        base_path = os.getcwd()
        responses_log_path = os.path.join(base_path, "gemini_responses_log.txt")
        events_log_path = os.path.join(base_path, "sorted_events_log.txt")

        with open(responses_log_path, "w", encoding="utf-8") as log_file:
            log_file.write("=== Gemini Similarity Responses Log ===\n\n")

            for i, description in enumerate(event_descriptions, start=1):
                prompt = f"""
        You are a strict numeric evaluator. 
        Compare the EVENT DESCRIPTION below to the USER QUERY, and respond ONLY with a number from 0 to 100.
        Do NOT add any words, punctuation, or explanation.

        USER QUERY:
        {query}

        EVENT DESCRIPTION:
        {description}

        Your numeric score (0–100):
        """

                try:
                    response = similarity_model.generate_content(
                        [prompt],
                        generation_config={"max_output_tokens": 5, "temperature": 0.0},
                    )

                    text = ""
                    if response.candidates and response.candidates[0].content.parts:
                        text = "".join(
                            p.text for p in response.candidates[0].content.parts if hasattr(p, "text")
                        ).strip()

                    try:
                        score = float(text)
                    except ValueError:
                        print(f"⚠️ Gemini returned invalid score: '{text}'")
                        score = 0.0

                    gemini_responses.append(score)

                    # Write Gemini response details
                    log_file.write(f"[{i}] Event Description: {description[:100]}...\n")
                    log_file.write(f"    Gemini Raw Response: {text}\n")
                    log_file.write(f"    Parsed Score: {score}\n\n")

                except Exception as e:
                    gemini_responses.append(0.0)
                    log_file.write(f"[{i}] ERROR processing description: {description[:100]}...\n")
                    log_file.write(f"    Error: {e}\n\n")

        # --- After all scores are computed ---
        scored_events = list(zip(events, gemini_responses))
        scored_events.sort(key=lambda x: x[1], reverse=True)
        events = [event for event, _ in scored_events]

        # Save sorted events to a text file
        with open(events_log_path, "w", encoding="utf-8") as events_file:
            events_file.write("=== Sorted Events by Gemini Similarity ===\n\n")
            for i, event in enumerate(events, start=1):
                title = getattr(event, "title", "Untitled")
                description = getattr(event, "description", "")
                score = gemini_responses[i - 1] if i - 1 < len(gemini_responses) else "N/A"
                events_file.write(f"[{i}] {title}\n")
                events_file.write(f"    Score: {score}\n")
                events_file.write(f"    Description: {description[:200]}...\n\n")

        # Limit the number of events returned
        events = events[:20]

        print(f"✅ Found {len(events)} events")
        print(f"📝 Gemini responses logged to: {responses_log_path}")
        print(f"🗂️  Sorted events saved to: {events_log_path}")

        return events

        
    except Exception as e:
        print(f"\n❌ ERROR in get_events_from_db: {e}")
        import traceback
        traceback.print_exc()
        return []
    

# --- 3. NEW Tool Definition (for Contextual Question) ---
generate_vibe_question_tool = {
    "name": "generate_vibe_question",
    "description": "Generates one contextual question and three short, emoji-first answer options for an event, based on its tags.",
    "parameters": {
        "type": "object",
        "properties": {
            "question": {
                "type": "string",
                "description": "The contextual question to ask users. (e.g., 'What's the energy like?', 'How's the food situation?')"
            },
            "option_1": {
                "type": "string",
                "description": "The first answer option (e.g., '🙂 Chill')"
            },
            "option_2": {
                "type": "string",
                "description": "The second answer option (e.g., '📣 Hype')"
            },
            "option_3": {
                "type": "string",
                "description": "The third answer option (e.g., '🔥 Electric')"
            }
        },
        "required": ["question", "option_1", "option_2", "option_3"]
    }
}