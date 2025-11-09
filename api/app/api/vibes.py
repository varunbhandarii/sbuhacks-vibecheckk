# File: api/app/api/vibes.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, Case, cast, Float, Integer
from datetime import datetime, timedelta
import uuid
import pytz

from app.dependencies import get_db
from app.models import Event, Space, UserAnon, Vibe, VibeTargetEnum, VibeRatingEnum
from app.models import WorthItRatingEnum  # <-- IMPORT NEW ENUM
from app.schemas import VibeCreate, VibePublic, VibeSummary
from app.core.auth_utils import get_current_anon_user
from app.websocket_manager import manager

router = APIRouter()

# --- NEW: Mapping for Q1 Answer ---
WORTH_IT_MAP = {
    "👎 Skip": WorthItRatingEnum.skip,
    "🤷 Maybe": WorthItRatingEnum.maybe,
    "👍 Worth it": WorthItRatingEnum.worth_it
}

# --- Helper: Map Enums to Numbers (FIXED) ---
# This logic now needs to handle both types
RATING_ENUM_TO_NUM = Case(
    # Event Q1
    (Vibe.worth_it_rating == WorthItRatingEnum.skip, 1),
    (Vibe.worth_it_rating == WorthItRatingEnum.maybe, 2),
    (Vibe.worth_it_rating == WorthItRatingEnum.worth_it, 3),
    
    # Space Rating
    (Vibe.rating_enum == VibeRatingEnum.empty, 1),
    (Vibe.rating_enum == VibeRatingEnum.studying, 2),
    (Vibe.rating_enum == VibeRatingEnum.lively, 3),
    (Vibe.rating_enum == VibeRatingEnum.packed, 4),
    else_=None
)

# --- Helper function (UPDATED) ---
def _get_vibe_summary_logic(
    target_type: VibeTargetEnum, 
    target_id: uuid.UUID, 
    db: Session
) -> VibeSummary:
    """
    The core logic to calculate a vibe summary for a target.
    """
    time_now = datetime.now(tz=pytz.UTC)
    trend_window_start = time_now - timedelta(minutes=30)
    
    base_query = db.query(Vibe).filter(
        Vibe.target_type == target_type,
        Vibe.target_id == target_id
    )

    numerical_rating = cast(RATING_ENUM_TO_NUM, Float)
    
    aggregates = base_query.with_entities(
        func.count(Vibe.id).label("count"),
        func.avg(numerical_rating).label("avg_rating")
        # Removed avg_food, avg_crowd, avg_queue
    ).first()
    
    if not aggregates or aggregates.count == 0:
        return VibeSummary(
            target_id=target_id, target_type=target_type, count=0,
            avg_rating=None, trend=0.0
        )

    recent_avg = base_query.filter(
        Vibe.ts >= trend_window_start
    ).with_entities(func.avg(numerical_rating)).scalar() or 0.0

    older_avg = base_query.filter(
        Vibe.ts < trend_window_start
    ).with_entities(func.avg(numerical_rating)).scalar() or 0.0

    trend = (recent_avg - older_avg) if older_avg > 0 else recent_avg

    return VibeSummary(
        target_id=target_id,
        target_type=target_type,
        count=aggregates.count,
        avg_rating=aggregates.avg_rating,
        trend=round(trend, 2)
    )

# --- create_vibe (HEAVILY UPDATED) ---
@router.post("/", response_model=VibePublic, status_code=status.HTTP_201_CREATED)
async def create_vibe(
    vibe_data: VibeCreate,
    db: Session = Depends(get_db),
    current_user: UserAnon = Depends(get_current_anon_user)
):
    """
    Submits a new vibe.
    Handles 'event' types (Q1/Q2) and 'space' types (old system).
    """
    
    # Initialize the new vibe object
    new_vibe = Vibe(
        anon_id=current_user.anon_id,
        target_type=vibe_data.target_type,
        target_id=vibe_data.target_id
    )

    if vibe_data.target_type == VibeTargetEnum.event:
        # --- Handle Event Vibe (Q1/Q2) ---
        
        # Map Q1 answer string to enum
        mapped_rating = WORTH_IT_MAP.get(vibe_data.answer_1)
        if not mapped_rating:
            raise HTTPException(status_code=422, detail=f"Invalid answer_1 value: {vibe_data.answer_1}")
            
        new_vibe.worth_it_rating = mapped_rating
        new_vibe.contextual_answer = vibe_data.answer_2
        
    elif vibe_data.target_type == VibeTargetEnum.space:
        # --- Handle Space Vibe (Old System) ---
        if not vibe_data.rating_enum:
             raise HTTPException(status_code=422, detail="rating_enum is required for 'space' vibes")
        
        new_vibe.rating_enum = vibe_data.rating_enum
        new_vibe.food_rating = vibe_data.food_rating
        new_vibe.crowd_rating = vibe_data.crowd_rating
        new_vibe.queue_rating = vibe_data.queue_rating
        
    else:
        raise HTTPException(status_code=422, detail=f"Vibe submission not supported for target_type: {vibe_data.target_type}")

    try:
        db.add(new_vibe)
        db.commit()
        db.refresh(new_vibe)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to submit vibe: {e}")
        
    # --- Broadcast logic (no change needed) ---
    summary_data = _get_vibe_summary_logic(
        new_vibe.target_type, 
        new_vibe.target_id, 
        db
    )
    
    await manager.broadcast(
        new_vibe.target_id, 
        summary_data.model_dump(mode='json')
    )
        
    return new_vibe

# --- get_vibe_summary (UPDATED) ---
@router.get("/summary", response_model=VibeSummary)
def get_vibe_summary(
    target_type: VibeTargetEnum = Query(..., description="Type of target (event or space)"),
    target_id: uuid.UUID = Query(..., description="UUID of the target"),
    db: Session = Depends(get_db)
):
    """
    Gets the aggregated vibe summary (Q1) for a specific event or space.
    """
    return _get_vibe_summary_logic(target_type, target_id, db)