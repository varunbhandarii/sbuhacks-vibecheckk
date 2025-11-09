from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import uuid

from app.dependencies import get_db
from app.schemas import TokenRequest, TokenResponse
from app.core.auth_utils import verify_auth0_token, mint_anonymous_token
# --- Import the models we need for the lookup ---
from app.models import UserAnon, AuthLink, UserProfile, RoleEnum

router = APIRouter()

@router.post("/token", response_model=TokenResponse)
async def exchange_token(
    body: TokenRequest, 
    db: Session = Depends(get_db)
):
    """
    Exchanges a valid Auth0 Access Token for an internal Anonymous Token.
    This endpoint is the main gateway for user authentication.
    """
    # 1. Verify the Auth0 token.
    payload = await verify_auth0_token(body.access_token)
    
    # 2. Get the unique Auth0 user ID ('sub') from the payload
    auth0_sub = payload.get("sub")
    if not auth0_sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Auth0 token missing 'sub' claim."
        )
        
    # 3. Find or Create the user link
    auth_link = db.query(AuthLink).filter(AuthLink.auth0_sub == auth0_sub).first()
    
    # --- THIS IS THE UPDATED LOGIC ---
    user_role: RoleEnum = RoleEnum.student  # Default to student
    
    if auth_link:
        # --- Existing User ---
        anon_id = auth_link.anon_id
        
        # Look up their profile to get their real role
        profile = db.query(UserProfile).filter(UserProfile.auth0_sub == auth_link.auth0_sub).first()
        if profile:
            user_role = profile.role
        
    else:
        # --- New User ---
        # 1. Create a new anonymous user entry
        new_anon_user = UserAnon()
        db.add(new_anon_user)
        
        # 2. Create the link
        new_auth_link = AuthLink(
            auth0_sub=auth0_sub,
            user=new_anon_user
        )
        db.add(new_auth_link)
        
        # 3. Create their new user profile
        new_username = f"user_{uuid.uuid4().hex[:12]}"
        
        new_profile = UserProfile(
            auth_link=new_auth_link,
            auth0_sub=auth0_sub,
            username=new_username,
            display_name=new_username
            # 'role' will use the database default, which is 'student'
        )
        db.add(new_profile)
        
        # 4. Set role and anon_id for the token
        user_role = new_profile.role  # This will be RoleEnum.student
        
        try:
            db.commit()
            db.refresh(new_anon_user)
            anon_id = new_anon_user.anon_id
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create new user: {e}"
            )
    
    # 4. Mint our internal anonymous token
    #    (Now passing the correct role)
    anonymous_token = mint_anonymous_token(anon_id=anon_id, role=user_role)
    
    return TokenResponse(anonymous_token=anonymous_token)