# File: api/app/api/rsvp.py
from fastapi import APIRouter, Depends, HTTPException, status, Path
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
import uuid

from app.dependencies import get_db
from app.models import (
    RSVP, UserAnon, RSVPStatusEnum, 
    UserProfile, AuthLink, RSVPVisibilityEnum
)
# --- UPDATED SCHEMAS ---
from app.schemas import (
    RSVPCreate, RSVPPublic, RSVPSummary, RSVPCounts, FeedbackAuthor
)
from app.core.auth_utils import (
    get_current_anon_user, 
    get_current_anon_user_optional
)

router = APIRouter()

@router.post("/", response_model=RSVPPublic)
def create_or_update_rsvp(
    rsvp_data: RSVPCreate,
    db: Session = Depends(get_db),
    current_user: UserAnon = Depends(get_current_anon_user)
):
    """
    Create or update an RSVP for an event.
    This uses "upsert" logic:
    - If the user has no RSVP, it's created.
    - If the user has an RSVP, it's updated.
    Requires a valid anonymous student token.
    """
    
    # Check if an RSVP already exists for this user and event
    existing_rsvp = db.query(RSVP).filter(
        RSVP.anon_id == current_user.anon_id,
        RSVP.event_id == rsvp_data.event_id
    ).first()
    
    if existing_rsvp:
        # --- Update existing RSVP ---
        existing_rsvp.status = rsvp_data.status
        existing_rsvp.visibility = rsvp_data.visibility
        rsvp_to_return = existing_rsvp
    else:
        # --- Create new RSVP ---
        new_rsvp = RSVP(
            anon_id=current_user.anon_id,
            event_id=rsvp_data.event_id,
            status=rsvp_data.status,
            visibility=rsvp_data.visibility
        )
        db.add(new_rsvp)
        rsvp_to_return = new_rsvp

    try:
        db.commit()
        db.refresh(rsvp_to_return)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update RSVP: {e}"
        )
        
    return rsvp_to_return

@router.get("/{event_id}/counts", response_model=RSVPSummary)
def get_rsvp_summary(event_id: uuid.UUID = Path(...), db: Session = Depends(get_db),
                     current_user: Optional[UserAnon] = Depends(get_current_anon_user_optional)):
    going_count = db.query(RSVP).filter(RSVP.event_id == event_id, RSVP.status == RSVPStatusEnum.going).count()
    interested_count = db.query(RSVP).filter(RSVP.event_id == event_id, RSVP.status == RSVPStatusEnum.interested).count()
    counts = RSVPCounts(going=going_count, interested=interested_count)

    user_status = None
    user_visibility = None
    if current_user:
        user_rsvp = db.query(RSVP).filter(RSVP.event_id == event_id, RSVP.anon_id == current_user.anon_id).first()
        if user_rsvp:
            user_status = user_rsvp.status
            user_visibility = user_rsvp.visibility

    return RSVPSummary(counts=counts, user_status=user_status, user_visibility=user_visibility)


# --- NEW ENDPOINT FOR FRONTEND GUY ---

@router.get("/{event_id}/attendees", response_model=List[FeedbackAuthor])
def get_public_attendees(
    event_id: uuid.UUID = Path(..., description="The event ID to get attendees for"),
    db: Session = Depends(get_db)
):
    """
    (Public) Gets the list of public attendees (username + image) for an event.
    This query joins RSVPs -> Users -> AuthLinks -> Profiles.
    """
    
    # This query finds all UserProfiles for users who are...
    # 1. Going to the event
    # 2. Set their visibility to public
    attendee_profiles = db.query(UserProfile).join(
        AuthLink, UserProfile.auth0_sub == AuthLink.auth0_sub
    ).join(
        UserAnon, AuthLink.anon_id == UserAnon.anon_id
    ).join(
        RSVP, UserAnon.anon_id == RSVP.anon_id
    ).filter(
        RSVP.event_id == event_id,
        RSVP.status == RSVPStatusEnum.going,
        RSVP.visibility == RSVPVisibilityEnum.public
    ).all()
    
    # Pydantic's from_attributes=True in the FeedbackAuthor schema
    # will automatically map the UserProfile objects to the schema.
    return attendee_profiles