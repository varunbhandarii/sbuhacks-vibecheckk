from fastapi import APIRouter, Depends, HTTPException, status, Path
from sqlalchemy.orm import Session
from sqlalchemy import func, case, cast, Float, desc, and_
from typing import List
import uuid
from datetime import datetime, timedelta
import pytz

from app.dependencies import get_db
from app.models import Event, UserAnon, Vibe, RSVP, RSVPStatusEnum, VibeTargetEnum, WorthItRatingEnum, AuthLink
from app.schemas import EventCreate, EventPublic
from app.security import get_current_organizer
from fastapi import Query
from typing import Optional
from app.api.ai_vibe import get_contextual_question_from_gemini
from app.models import EventFeedback, UserProfile
from app.schemas import FeedbackCreate, FeedbackPublic, FeedbackAuthor
from app.core.auth_utils import get_current_anon_user # <-- MAKE SURE THIS IS IMPORTED


router = APIRouter()

# --- Helper: Map Enums to Numbers (UPDATED) ---
RATING_ENUM_TO_NUM = case(
    (Vibe.worth_it_rating == WorthItRatingEnum.skip, 1),
    (Vibe.worth_it_rating == WorthItRatingEnum.maybe, 2),
    (Vibe.worth_it_rating == WorthItRatingEnum.worth_it, 3),
    else_=0.0
)

@router.post("/", response_model=EventPublic, status_code=status.HTTP_201_CREATED)
def create_event(
    event: EventCreate,
    db: Session = Depends(get_db),
    current_user: UserAnon = Depends(get_current_organizer)
):
    """
    Creates a new event and generates a contextual vibe question.
    Requires a valid ORGANIZER token.
    """
    
    # --- 1. Call Gemini to get the contextual question ---
    print(f"Generating contextual question for: {event.title}")
    q_data = get_contextual_question_from_gemini(event.title, event.tags)
    
    question_text = None
    question_options = None
    if q_data and q_data.get("question") and q_data.get("options"):
        question_text = q_data["question"]
        question_options = q_data["options"]
        print(f"  -> Generated Q: {question_text}")
    else:
        print("  -> AI failed to generate question, will use null.")

    # --- 2. Create the Event object with the new data ---
    new_event = Event(
        title=event.title,
        description=event.description,
        start_time=event.start_time,
        end_time=event.end_time,
        location_name=event.location_name,
        location_lat=event.location_lat,
        location_lon=event.location_lon,
        tags=event.tags,
        image_url=event.image_url,
        created_by=current_user.anon_id,
        
        # --- ADDED ---
        vibe_question_2_text=question_text,
        vibe_question_2_options=question_options
    )
    
    try:
        db.add(new_event)
        db.commit()
        db.refresh(new_event)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create event: {e}"
        )
        
    return new_event

@router.get("/", response_model=List[EventPublic])
def get_all_events(
    db: Session = Depends(get_db),
    filter: Optional[str] = Query(None, description="Filter events (e.g., 'upcoming')"),
    sort: Optional[str] = Query("time", description="Sort order (e.g., 'time' or 'hyped')")
):
    """
    Gets a list of all events, with optional filtering and sorting.
    
    - ?filter=upcoming: Only shows events that haven't ended.
    - ?sort=time: Sorts by soonest first (default).
    - ?sort=hyped: Sorts by most 'going' + 'interested' RSVPs.
    """
    
    now = datetime.now(pytz.utc)
    
    # Base query
    query = db.query(Event)
    
    # Apply Filtering
    if filter == "upcoming":
        query = query.filter(Event.end_time >= now)

    # Apply Sorting
    if sort == "hyped":
        # Create a subquery to count "hype" (going + interested)
        hype_counts = db.query(
            RSVP.event_id,
            (func.count(RSVP.id).filter(
                RSVP.status.in_([RSVPStatusEnum.going, RSVPStatusEnum.interested])
            )).label("hype_count")
        ).group_by(RSVP.event_id).subquery()
        
        # Join with the subquery and order by the hype_count
        query = query.join(
            hype_counts, Event.id == hype_counts.c.event_id, isouter=True
        ).order_by(
            desc(func.coalesce(hype_counts.c.hype_count, 0))
        )
    else:
        # Default sort by time
        query = query.order_by(Event.start_time.asc())

    events = query.all()
    return events

@router.get("/recommendations", response_model=List[EventPublic])
def get_recommendations(
    db: Session = Depends(get_db)
):
    """
    Gets the "What's Hot" list of events.
    This is based on the *new* Q1 vibe system.
    
    Score = w1*current_vibe + w2*trend + w3*RSVP_count
    """
    
    now = datetime.now(pytz.utc)
    trend_window_start = now - timedelta(minutes=60)
    
    # --- 1. CTE: Vibe Calculations ---
    # Get the raw numerical rating for all *event* vibes
    vibe_calcs_cte = db.query(
        Vibe.target_id.label("event_id"),
        Vibe.ts,
        # This uses the RATING_ENUM_TO_NUM helper, which correctly
        # maps skip=1, maybe=2, worth_it=3
        cast(RATING_ENUM_TO_NUM, Float).label("numerical_rating")
    ).filter(
        Vibe.target_type == VibeTargetEnum.event,
        Vibe.worth_it_rating != None # Ensure we only score event vibes
    ).subquery()

    # --- 2. CTE: Vibe Scores (Aggregated) ---
    vibe_scores_cte = db.query(
        vibe_calcs_cte.c.event_id,
        func.avg(vibe_calcs_cte.c.numerical_rating).label("avg_vibe"),
        func.avg(
            case(
                (vibe_calcs_cte.c.ts >= trend_window_start, vibe_calcs_cte.c.numerical_rating),
                else_=None
            )
        ).label("recent_avg"),
        func.avg(
            case(
                (vibe_calcs_cte.c.ts < trend_window_start, vibe_calcs_cte.c.numerical_rating),
                else_=None
            )
        ).label("older_avg")
    ).group_by(
        vibe_calcs_cte.c.event_id
    ).subquery()

    # --- 3. CTE: RSVP Scores ---
    rsvp_scores_cte = db.query(
        RSVP.event_id,
        func.count(RSVP.id).filter(RSVP.status == RSVPStatusEnum.going).label("going_count")
    ).group_by(
        RSVP.event_id
    ).subquery()

    # --- 4. Main Query: Combine Scores ---
    trend_score = case(
        (
            (vibe_scores_cte.c.older_avg == None) | (vibe_scores_cte.c.older_avg == 0), 
            func.coalesce(vibe_scores_cte.c.recent_avg, 0.0)
        ),
        else_=(
            func.coalesce(vibe_scores_cte.c.recent_avg, 0.0) - 
            func.coalesce(vibe_scores_cte.c.older_avg, 0.0)
        )
    ).label("trend_score")
    
    vibe_score = func.coalesce(vibe_scores_cte.c.avg_vibe, 0.0).label("vibe_score")
    rsvp_score = func.coalesce(rsvp_scores_cte.c.going_count, 0.0).label("rsvp_score")

    hot_score = (
        (vibe_score * 0.4) +   # w1 * current_vibe
        (trend_score * 0.3) +  # w2 * trend
        (rsvp_score * 0.3)     # w3 * RSVP_count
    ).label("hot_score")
    
    # --- 5. Execute the Query ---
    # We define "Live" as starting in the past 3 hours or in the next 1 hour
    live_window_start = now - timedelta(hours=3)
    live_window_end = now + timedelta(hours=1)
    
    ranked_events = db.query(
        Event, 
        hot_score
    ).join(
        vibe_scores_cte, Event.id == vibe_scores_cte.c.event_id, isouter=True
    ).join(
        rsvp_scores_cte, Event.id == rsvp_scores_cte.c.event_id, isouter=True
    ).filter(
        # Only show "Live" events
        Event.start_time < live_window_end,
        Event.end_time > now
    ).order_by(
        desc(hot_score)
    ).limit(20).all()

    events_only = [event for event, score in ranked_events]
    
    return events_only
@router.get("/{event_id}", response_model=EventPublic)
def get_event_by_id(
    event_id: uuid.UUID = Path(..., description="The event ID to get a single event"),
    db: Session = Depends(get_db)
):
    """
    Gets a single event by its unique ID.
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
        
    return event

@router.post(
    "/{event_id}/feedback", 
    response_model=FeedbackPublic,
    status_code=status.HTTP_201_CREATED
)
def create_event_feedback(
    event_id: uuid.UUID,
    feedback_data: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: UserAnon = Depends(get_current_anon_user)
):
    """
    (Protected) Submits a rating and review for an event.
    """
    
    # 1. Find the event
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    # 2. Check if event is over
    now = datetime.now(pytz.utc)
    if event.end_time > now:
        raise HTTPException(
            status_code=400, 
            detail="Cannot submit feedback for an event that has not ended."
        )
        
    # 3. Check if user already submitted feedback
    existing_feedback = db.query(EventFeedback).filter(
        EventFeedback.event_id == event_id,
        EventFeedback.anon_id == current_user.anon_id
    ).first()
    
    if existing_feedback:
        raise HTTPException(
            status_code=409, # 409 Conflict
            detail="You have already submitted feedback for this event."
        )
    
    # 4. Create new feedback
    new_feedback = EventFeedback(
        event_id=event_id,
        anon_id=current_user.anon_id,
        rating=feedback_data.rating,
        review=feedback_data.review
    )
    
    try:
        db.add(new_feedback)
        db.commit()
        db.refresh(new_feedback)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to submit feedback: {e}")

    # 5. Get author profile for the response
    author_profile = db.query(UserProfile).join(AuthLink).filter(
        AuthLink.anon_id == current_user.anon_id
    ).first()
    
    # Manually construct the response
    response_data = FeedbackPublic.model_validate(new_feedback)
    if author_profile:
        response_data.author = FeedbackAuthor.model_validate(author_profile)
    
    return response_data

@router.get(
    "/{event_id}/feedback", 
    response_model=List[FeedbackPublic]
)
def get_event_feedback(
    event_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """
    (Public) Gets all feedback for a specific event.
    """
    
    # This query joins Feedback -> UserAnon -> AuthLink -> UserProfile
    # to get the author's public username
    feedback_list = db.query(EventFeedback).join(
        UserAnon, EventFeedback.anon_id == UserAnon.anon_id
    ).join(
        AuthLink, UserAnon.anon_id == AuthLink.anon_id
    ).join(
        UserProfile, AuthLink.auth0_sub == UserProfile.auth0_sub
    ).filter(
        EventFeedback.event_id == event_id
    ).with_entities(
        EventFeedback.id,
        EventFeedback.event_id,
        EventFeedback.rating,
        EventFeedback.review,
        EventFeedback.ts,
        UserProfile.username,
        UserProfile.profile_image_url
    ).order_by(EventFeedback.ts.desc()).all()

    # Manually construct the nested response
    results = []
    for fb in feedback_list:
        results.append(
            FeedbackPublic(
                id=fb.id,
                event_id=fb.event_id,
                rating=fb.rating,
                review=fb.review,
                ts=fb.ts,
                author=FeedbackAuthor(
                    username=fb.username,
                    profile_image_url=fb.profile_image_url
                )
            )
        )
    
    return results