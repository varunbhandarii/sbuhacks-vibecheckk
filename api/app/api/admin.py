# File: api/app/api/admin.py
from fastapi import APIRouter, Depends, Path, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.models import UserProfile, RoleEnum
from app.schemas import ProfilePublic
from app.security import verify_admin_key

router = APIRouter()

@router.post("/promote/{username}", response_model=ProfilePublic)
def promote_user_to_organizer(
    username: str = Path(..., description="The username of the user to promote"),
    db: Session = Depends(get_db),
    is_admin: bool = Depends(verify_admin_key) # <-- SECURES THE ENDPOINT
):
    """
    Promotes a user to the 'organizer' role.
    This endpoint is protected by the ADMIN_SECRET_KEY.
    """
    profile = db.query(UserProfile).filter(UserProfile.username == username).first()

    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    profile.role = RoleEnum.organizer

    try:
        db.commit()
        db.refresh(profile)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to promote user: {e}")

    return profile