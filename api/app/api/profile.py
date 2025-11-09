# File: api/app/api/profile.py
from fastapi import APIRouter, Depends, HTTPException, status, Path
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.dependencies import get_db
from app.models import UserAnon, UserProfile, AuthLink
from app.schemas import ProfilePublic, ProfileUpdate
from app.core.auth_utils import get_current_anon_user
import uuid

router = APIRouter()

def get_profile_by_anon_user(db: Session, user: UserAnon) -> UserProfile:
    """
    Helper to "get or create" a profile from an authenticated anon_user.
    """
    if not user.auth_link or not user.auth_link.auth0_sub:
        raise HTTPException(status_code=404, detail="Auth link not found")
        
    auth0_sub = user.auth_link.auth0_sub
    
    profile = db.query(UserProfile).filter(
        UserProfile.auth0_sub == auth0_sub
    ).first()
    
    # --- THIS IS THE FIX ---
    # If the profile doesn't exist, create a blank one for the user.
    if not profile:
        try:
            # Generate a temporary, unique username.
            # The user will be forced to change this on their first PUT.
            temp_username = f"user_{uuid.uuid4().hex[:12]}"
            
            new_profile = UserProfile(
                auth0_sub=auth0_sub,
                username=temp_username,
                display_name="New User" # Default display name
                # bio will be null by default
            )
            db.add(new_profile)
            db.commit()
            db.refresh(new_profile)
            return new_profile
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to auto-create profile: {e}"
            )
    # --- END OF FIX ---
            
    return profile

@router.get("/me", response_model=ProfilePublic)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: UserAnon = Depends(get_current_anon_user)
):
    """Gets the profile for the currently authenticated user."""
    profile = get_profile_by_anon_user(db, current_user)
    return profile

@router.put("/me", response_model=ProfilePublic)
def update_my_profile(
    profile_data: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: UserAnon = Depends(get_current_anon_user)
):
    """Updates the profile for the currently authenticated user."""
    profile = get_profile_by_anon_user(db, current_user)
    
    # Get a dict of only the fields the user *actually* sent
    update_data = profile_data.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")

    # Update the profile fields
    for key, value in update_data.items():
        setattr(profile, key, value)
        
    try:
        db.commit()
        db.refresh(profile)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409, # 409 Conflict
            detail="Username already taken."
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating profile: {e}")
        
    return profile

@router.get("/{username}", response_model=ProfilePublic)
def get_profile_by_username(
    username: str = Path(..., description="The username of the profile to fetch"),
    db: Session = Depends(get_db)
):
    """Gets a public profile by its username."""
    profile = db.query(UserProfile).filter(
        UserProfile.username == username
    ).first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    
    return profile