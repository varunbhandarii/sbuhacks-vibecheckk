import os
import re
import json
import math
import html
import time
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timedelta
from dateutil import parser as dtparse
import pytz

import feedparser
import google.generativeai as genai
from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session  # kept to satisfy your Depends(get_db) signature

from app.dependencies import get_db
from app.schemas import AIQueryRequest, AIQueryResponse, AIEventCard
from app.core.config import settings
from app.api.ai_system_instructions import VIBECHECK_SYSTEM_INSTRUCTIONS

# Optional lightweight search (no API key)
try:
    from duckduckgo_search import DDGS
except Exception:
    DDGS = None  # search becomes a no-op if not available

router = APIRouter()

# ---------- Config ----------
FEED_URL = os.getenv("SBU_EVENTS_FEED", "https://stonybrook.campuslabs.com/engage/events.rss")
SBU_TZ = pytz.timezone("America/New_York")
CACHE_TTL_SECONDS = 240  # Engage ttl=300; we keep a little shorter
MAX_EVENTS_TO_INCLUDE = 200  # safety cap for prompt size
MAX_EVENTS_TO_RETURN = 20    # for optional structured extraction
MODEL_NAME = "models/gemini-flash-latest"

# ---------- Gemini ----------
try:
    genai.configure(api_key=settings.GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel(
        model_name=MODEL_NAME,
        system_instruction=VIBECHECK_SYSTEM_INSTRUCTIONS,
    )
    print(f"✅ Gemini model ready: {MODEL_NAME}")
except Exception as e:
    print(f"❌ Failed to init Gemini: {e}")
    gemini_model = None

# ---------- Simple in-process cache for the RSS ----------
_FEED_CACHE: Dict[str, Any] = {
    "fetched_at": 0.0,
    "items": [],
    "raw_text": "",
}

def _strip_html(html_str: str) -> str:
    if not html_str:
        return ""
    soup = BeautifulSoup(html_str, "html.parser")
    text = soup.get_text(" ", strip=True)
    return re.sub(r"\s+", " ", text).strip()

def _parse_dt(dt_str: str) -> Optional[datetime]:
    if not dt_str:
        return None
    try:
        dt = dtparse.parse(dt_str)
        if not dt.tzinfo:
            dt = SBU_TZ.localize(dt)
        return dt.astimezone(SBU_TZ)
    except Exception:
        return None

def _coerce_time(x: Any) -> Optional[datetime]:
    if isinstance(x, datetime):
        return x.astimezone(SBU_TZ)
    if isinstance(x, str):
        return _parse_dt(x)
    return None

def _fetch_feed() -> Tuple[List[Dict[str, Any]], str]:
    """Fetch & normalize RSS to a list of dicts + a compact text index."""
    d = feedparser.parse(FEED_URL)
    items = []
    for e in d.entries:
        title = (e.get("title") or "").strip()
        link = e.get("link") or e.get("guid")
        desc_html = e.get("description") or ""
        desc = _strip_html(desc_html)

        # CampusLabs embeds <events:start> & <events:end> in GMT; feedparser maps them as e.get('start', None) sometimes
        # Also try to recover from embedded HTML <time> tags if fields absent
        start = e.get("start") or None
        end = e.get("end") or None
        loc = e.get("location") or ""
        if not start or not end:
            # try parse from description's <time> blocks
            # This is best-effort; we already have <events:start>/<events:end> in sample
            pass

        start_dt = _coerce_time(start)
        end_dt = _coerce_time(end)

        # categories/tags
        cats = []
        try:
            for c in e.get("tags", []) or []:
                term = c.get("term") if isinstance(c, dict) else getattr(c, "term", None)
                if term:
                    cats.append(str(term).strip())
        except Exception:
            pass

        img = None
        enc = e.get("enclosures") or []
        if enc and isinstance(enc, list):
            # pick the first image
            for en in enc:
                url = en.get("href") or en.get("url")
                if url and isinstance(url, str) and any(url.lower().endswith(x) for x in (".jpg", ".jpeg", ".png", ".webp")):
                    img = url
                    break

        items.append({
            "title": title,
            "link": link,
            "description": desc,
            "start_time": start_dt.isoformat() if start_dt else None,
            "end_time": end_dt.isoformat() if end_dt else None,
            "location": _strip_html(loc),
            "categories": cats,
            "image_url": img,
        })

    # Sort by start_time if available
    def sort_key(it):
        return it["start_time"] or "9999-12-31T00:00:00-05:00"
    items.sort(key=sort_key)

    # Build a compact, LLM-friendly TEXT index (1 line per event)
    # cap to limit prompt size
    lines = []
    for it in items[:MAX_EVENTS_TO_INCLUDE]:
        start_local = ""
        if it["start_time"]:
            dt = _parse_dt(it["start_time"])
            if dt:
                start_local = dt.strftime("%a %b %d, %I:%M %p")
        end_local = ""
        if it["end_time"]:
            dt2 = _parse_dt(it["end_time"])
            if dt2:
                end_local = dt2.strftime("%I:%M %p")
        when = f"{start_local}–{end_local}" if end_local else start_local

        cats = ", ".join(it["categories"]) if it["categories"] else ""
        loc = it["location"] or ""
        line = f"- {it['title']} | {when} | {loc} | {cats}"
        # Append a short desc tail to help LLM rank relevance
        if it["description"]:
            short = it["description"][:180]
            line += f" | {short}"
        lines.append(line)

    text_index = "EVENT INDEX (from SBU RSS)\n" + "\n".join(lines)
    return items, text_index

def _filter_upcoming(items: List[Dict[str, Any]], days: int = 7) -> List[Dict[str, Any]]:
    """Keep only events whose start_time is within the next `days` days."""
    now = datetime.now(SBU_TZ)
    cutoff = now + timedelta(days=days)
    filtered = []
    for it in items:
        start_str = it.get("start_time")
        if not start_str:
            continue  # skip events with no start time
        start_dt = _parse_dt(start_str)
        if start_dt and now <= start_dt <= cutoff:
            filtered.append(it)
    return filtered

def _get_feed_cached() -> Tuple[List[Dict[str, Any]], str]:
    now = time.time()
    if now - _FEED_CACHE["fetched_at"] < CACHE_TTL_SECONDS and _FEED_CACHE["items"]:
        return _FEED_CACHE["items"], _FEED_CACHE["raw_text"]
    try:
        items, _ = _fetch_feed()
        items = _filter_upcoming(items, days=7)
        # Rebuild the text index from the filtered set
        lines = []
        for it in items[:MAX_EVENTS_TO_INCLUDE]:
            start_local = ""
            if it["start_time"]:
                dt = _parse_dt(it["start_time"])
                if dt:
                    start_local = dt.strftime("%a %b %d, %I:%M %p")
            end_local = ""
            if it["end_time"]:
                dt2 = _parse_dt(it["end_time"])
                if dt2:
                    end_local = dt2.strftime("%I:%M %p")
            when = f"{start_local}\u2013{end_local}" if end_local else start_local
            cats = ", ".join(it["categories"]) if it["categories"] else ""
            loc = it["location"] or ""
            line = f"- {it['title']} | {when} | {loc} | {cats}"
            if it["description"]:
                short = it["description"][:180]
                line += f" | {short}"
            lines.append(line)
        text = "EVENT INDEX (upcoming 7 days from SBU RSS)\n" + "\n".join(lines)
        _FEED_CACHE["items"] = items
        _FEED_CACHE["raw_text"] = text
        _FEED_CACHE["fetched_at"] = now
        return items, text
    except Exception as e:
        # On error, return last cache if any
        if _FEED_CACHE["items"]:
            return _FEED_CACHE["items"], _FEED_CACHE["raw_text"]
        raise e

def _web_search_snippets(q: str, k: int = 5) -> str:
    """Optional: tiny search context using DuckDuckGo; returns a compact text block."""
    if not DDGS or not q.strip():
        return ""
    try:
        rows = []
        with DDGS() as ddgs:
            for r in ddgs.text(q, max_results=k):
                title = r.get("title") or ""
                href = r.get("href") or r.get("link") or ""
                body = (r.get("body") or "").replace("\n", " ")
                body = re.sub(r"\s+", " ", body).strip()
                rows.append(f"- {title} | {body[:200]} | {href}")
        return "WEB SEARCH SNIPPETS\n" + "\n".join(rows)
    except Exception:
        return ""

def _build_llm_prompt(user_text: str, text_index: str, search_text: str) -> str:
    sbu_now = datetime.now(SBU_TZ).strftime("%A, %B %d, %Y at %I:%M %p %Z")
    blocks = [
        f"[Current time: {sbu_now}]",
        "[User question]",
        user_text.strip(),
        "",
        text_index,
    ]
    if search_text:
        blocks.extend(["", search_text])
    blocks.append("""
Return a helpful, concise answer using the index (and search snippets if relevant).
Show up to 6 matching events as:
**Title**
📅 When · 📍 Where
1 short line why it's interesting

Do not include URLs or raw links in your answer.
If nothing matches, say that and suggest one follow-up.
""")
    return "\n".join(blocks).strip()

def _safe_json_extract(text: str) -> Optional[Any]:
    """If you later ask Gemini to return JSON, this will extract the first JSON block."""
    if not text:
        return None
    m = re.search(r"\{[\s\S]*\}|\[[\s\S]*\]", text)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None

def _normalize_events_for_response(selected: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Map feed items to the EventPublic-like dict your frontend expects (lenient)."""
    out = []
    for it in selected[:MAX_EVENTS_TO_RETURN]:
        out.append({
            "id": it.get("link") or it.get("title"),
            "title": it.get("title") or "",
            "description": it.get("description") or "",
            "start_time": it.get("start_time"),
            "end_time": it.get("end_time"),
            "location_name": it.get("location") or "",
            "tags": it.get("categories") or [],
            "image_url": it.get("image_url") or "",
        })
    return out

# ---------------------------------------------------------
# POST /ai/query — RSS-first pipeline
# ---------------------------------------------------------
@router.post("/query", response_model=AIQueryResponse)
def post_ai_query(query: AIQueryRequest, db: Session = Depends(get_db)):
    if not gemini_model:
        raise HTTPException(status_code=503, detail="AI not configured (GEMINI_API_KEY).")

    user_text = (query.text or "").strip()
    if not user_text:
        raise HTTPException(status_code=400, detail="Empty query.")

    # 1) Fetch & compact the RSS feed (cached)
    try:
        feed_items, feed_text = _get_feed_cached()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch events feed: {e}")

    # 2) Optional tiny web search (keep short, only if user hints at non-event info)
    wants_web = any(w in user_text.lower() for w in [
        "where is", "how do i", "what is", "hours", "open", "closed", "address", "directions", "parking", "news"
    ])
    search_text = _web_search_snippets(user_text, k=5) if wants_web else ""

    # 3) Build a single prompt with TEXT feed
    prompt = _build_llm_prompt(user_text, feed_text, search_text)

    # 4) Call Gemini once
    try:
        resp = gemini_model.generate_content(
            [prompt],
            generation_config={"temperature": 0.2, "top_p": 0.9},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini error: {e}")

    # 5) Extract text + (optional) structured events if you decide to parse them later
    text_out = ""
    try:
        if hasattr(resp, "text") and resp.text:
            text_out = resp.text.strip()
        elif hasattr(resp, "candidates") and resp.candidates:
            parts = resp.candidates[0].content.parts or []
            for p in parts:
                if hasattr(p, "text") and p.text:
                    text_out = p.text.strip()
                    break
    except Exception:
        pass

    if not text_out:
        text_out = "Hmm, I couldn’t pull anything useful from the feed right now. Try asking about a specific topic or time (e.g., “AI events this week”)."

    # 6) Match events mentioned in the LLM response to DB records
    text_lower = text_out.lower()
    matched_events: list[AIEventCard] = []
    seen_titles: set[str] = set()

    # Build a list of candidate titles from the feed
    candidate_titles: list[str] = []
    for it in feed_items:
        t = it.get("title") or ""
        if t:
            candidate_titles.append(t)

    # Find which feed titles are mentioned in the response
    mentioned_titles: list[str] = []
    for title in candidate_titles:
        if title.lower() in seen_titles:
            continue
        title_words = [w for w in re.findall(r'[a-z0-9]+', title.lower()) if len(w) > 2]
        if not title_words:
            continue
        word_hits = sum(1 for w in title_words if w in text_lower)
        match_ratio = word_hits / len(title_words)
        if match_ratio >= 0.70:
            seen_titles.add(title.lower())
            mentioned_titles.append(title)
        if len(mentioned_titles) >= 10:
            break

    # Look up mentioned events in the database by title
    if mentioned_titles:
        from app.models import Event as EventModel
        for title in mentioned_titles:
            db_event = db.query(EventModel).filter(
                EventModel.title == title
            ).first()
            if db_event:
                matched_events.append(AIEventCard(
                    id=str(db_event.id),
                    title=db_event.title,
                    description=(db_event.description or "")[:200],
                    start_time=db_event.start_time.isoformat() if db_event.start_time else None,
                    end_time=db_event.end_time.isoformat() if db_event.end_time else None,
                    location_name=db_event.location_name or "",
                    tags=db_event.tags or [],
                    image_url=db_event.image_url or "",
                ))

    return AIQueryResponse(
        text_response=text_out,
        events=matched_events,
    )
