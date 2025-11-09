# File: api/ingest_events.py

import feedparser
import pytz
import time
from bs4 import BeautifulSoup
from datetime import datetime
from sqlalchemy.orm import Session
from app.db import SessionLocal, engine
from app.models import Event, Base
from app.core.locations import geocode_location
from typing import List # <-- ADDED for type hinting

# --- ADDED: Import the AI function ---
from app.api.ai_1 import get_contextual_question_from_gemini
# --- END OF ADDED IMPORT ---

# RSS feed URL
RSS_URL = "https://stonybrook.campuslabs.com/engage/events.rss"


def safe_parse_iso(dt_str: str):
    """Parse ISO8601 safely with timezone awareness."""
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = pytz.utc.localize(dt)
        return dt
    except Exception:
        return None


def extract_location(entry, soup):
    """
    Robust location extraction:
    1. Try <events:location> tag
    2. Try HTML span.p-location
    3. Fallback to text search
    """
    loc = entry.get("events_location")
    if loc:
        return loc.strip()

    # Try from HTML
    loc_span = soup.find("span", class_="p-location")
    if loc_span:
        return loc_span.get_text(strip=True)

    # Fallback attempt
    p_tags = soup.find_all("p")
    for p in p_tags:
        text = p.get_text()
        if " at " in text:
            after_at = text.split(" at ")[-1].strip(" .")
            return after_at

    return "Unknown Location"


def extract_times(entry, soup):
    """
    Extract start and end times with multiple fallback strategies.
    """
    start_time = end_time = None

    # 1. Try from HTML ISO time tags
    try:
        start_tag = soup.find("time", class_="dt-start") or soup.find("time", class_="dtstart")
        end_tag = soup.find("time", class_="dt-end") or soup.find("time", class_="dtend")

        if start_tag and start_tag.has_attr("datetime"):
            start_time = safe_parse_iso(start_tag["datetime"])
        if end_tag and end_tag.has_attr("datetime"):
            end_time = safe_parse_iso(end_tag["datetime"])
    except Exception:
        pass

    # 2. Try from events:start / events:end (feedparser auto-parses custom tags)
    if not start_time:
        start_raw = entry.get("events_start")
        if start_raw:
            try:
                start_time = datetime.strptime(start_raw, "%a, %d %b %Y %H:%M:%S %Z")
                start_time = pytz.utc.localize(start_time)
            except Exception:
                pass

    if not end_time:
        end_raw = entry.get("events_end")
        if end_raw:
            try:
                end_time = datetime.strptime(end_raw, "%a, %d %b %Y %H:%M:%S %Z")
                end_time = pytz.utc.localize(end_time)
            except Exception:
                pass

    return start_time, end_time


def run_ingestion():
    """
    Main function to fetch, parse, and store events.
    """
    print("--- Starting Event Ingestion ---")
    db: Session = SessionLocal()

    # Fetch and parse feed
    print(f"Fetching feed from {RSS_URL}...")
    feed = feedparser.parse(RSS_URL)

    if not hasattr(feed, "status") or feed.status != 200:
        print(f"Error: Feed returned status {getattr(feed, 'status', 'UNKNOWN')}")
        db.close() # Close session before returning
        return

    print(f"Found {len(feed.entries)} events in the feed.")
    new_event_count = 0
    skipped_count = 0

    try:
        for entry in feed.entries:
            source_url = entry.link
            existing_event = db.query(Event).filter(Event.source_url == source_url).first()

            if existing_event:
                skipped_count += 1
                continue

            title = entry.title
            description_html = entry.description
            soup = BeautifulSoup(description_html, "html.parser")

            # Extract times
            start_time, end_time = extract_times(entry, soup)
            if not start_time or not end_time:
                print(f"Skipping '{title}' (no valid time found)")
                skipped_count += 1
                continue

            # Extract description
            desc_div = soup.find("div", class_="p-description")
            description = desc_div.get_text(separator="\n", strip=True) if desc_div else ""

            # Extract and geocode location
            raw_location = extract_location(entry, soup)
            loc_data = geocode_location(raw_location)

            # Image
            image_url = None
            if hasattr(entry, "enclosures") and entry.enclosures:
                image_url = entry.enclosures[0].href

            # Tags
            tags: List[str] = []
            if hasattr(entry, "tags"):
                tags = [tag.term for tag in entry.tags if hasattr(tag, "term")]

            # --- ADDED: Call Gemini to generate Q2 ---
            question_text = None
            question_options = None
            if tags: # Only try to generate a question if tags exist
                print(f"  -> Generating Q2 for: {title}")
                q_data = get_contextual_question_from_gemini(title, tags)
                if q_data and q_data.get("question") and q_data.get("options"):
                    question_text = q_data["question"]
                    question_options = q_data["options"]
                    print(f"  -> Generated Q: {question_text}")
                else:
                    print("  -> AI failed to generate question, using null.")
            else:
                print(f"  -> No tags for '{title}', skipping Q2 generation.")
            # --- END OF ADDED BLOCK ---

            # Create new Event object
            new_event = Event(
                title=title,
                description=description,
                start_time=start_time,
                end_time=end_time,
                location_name=loc_data["name"],
                location_lat=loc_data["lat"],
                location_lon=loc_data["lon"],
                source_url=source_url,
                image_url=image_url,
                tags=tags,
                created_by=None,
                
                # --- ADDED: Save Q2 to the database ---
                vibe_question_2_text=question_text,
                vibe_question_2_options=question_options
            )

            db.add(new_event)
            new_event_count += 1
            print(f"Added: {title} @ {loc_data['name']}")

        if new_event_count > 0:
            db.commit()

        print("--- Ingestion Complete ---")
        print(f"✅ Added:    {new_event_count} new events.")
        print(f"⚠️ Skipped: {skipped_count} duplicates or incomplete events.")

    except Exception as e:
        db.rollback()
        print(f"❌ Error during ingestion: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
        print("Database connection closed.")


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    run_ingestion()