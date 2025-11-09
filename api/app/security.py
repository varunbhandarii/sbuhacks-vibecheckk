# File: api/app/security.py
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.models import UserAnon, UserProfile, RoleEnum
from app.core.auth_utils import get_current_anon_user
from fastapi.security import APIKeyHeader # <-- ADD THIS IMPORT
from app.core.config import settings # <-- ADD THIS IMPORT

def get_current_organizer(
    # This dependency runs first. If the user isn't logged in,
    # it will raise a 401 Unauthorized error.
    user: UserAnon = Depends(get_current_anon_user),
    db: Session = Depends(get_db)
) -> UserAnon:
    """
    A dependency that verifies the current user has the 'organizer' role.
    If they do, it returns the UserAnon object.
    If not, it raises a 403 Forbidden error.
    """
    if not user.auth_link:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Not authorized: User has no auth link."
        )
        
    profile = db.query(UserProfile).filter(
        UserProfile.auth0_sub == user.auth_link.auth0_sub
    ).first()
    
    if not profile:
         raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Not authorized: User has no profile."
        )

    if profile.role != RoleEnum.organizer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have organizer privileges to perform this action."
        )
    
    # Success! Return the user object for the endpoint to use.
    return user

admin_key_scheme = APIKeyHeader(name="X-Admin-Key", auto_error=False)

def verify_admin_key(api_key: str = Depends(admin_key_scheme)):
    """A dependency to verify the hardcoded admin secret key."""
    if not api_key or api_key != settings.ADMIN_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing Admin API Key"
        )
    return True