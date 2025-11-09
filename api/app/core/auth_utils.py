import jwt
import httpx
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer, APIKeyHeader
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
import uuid

from app.core.config import settings
from app.dependencies import get_db
from app.models import UserAnon, RoleEnum  # <-- IMPORT RoleEnum

# --- Part 1: Auth0 Token Verification ---

# Use PyJWT's JWK client to fetch public keys from Auth0
jwks_client = jwt.PyJWKClient(
    f"https://{settings.AUTH0_DOMAIN}/.well-known/jwks.json"
)

async def verify_auth0_token(token: str) -> dict:
    """
    Verifies an Auth0 access token and returns its decoded payload.
    """
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token).key
        
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            audience=settings.AUTH0_API_AUDIENCE,
            issuer=f"https://{settings.AUTH0_DOMAIN}/",
        )
        return payload
    
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired."
        )
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Error validating token: {e}"
        )

# --- Part 2: Anonymous Token Minting (UPDATED) ---

def mint_anonymous_token(anon_id: str, role: RoleEnum | str) -> str:
    """
    Creates our internal, short-lived anonymous JWT with a specific role.
    """
    expires_delta = timedelta(days=3)
    
    # Convert RoleEnum to a string value (e.g., "organizer")
    role_str = role.value if isinstance(role, RoleEnum) else str(role)
    
    payload = {
        "exp": datetime.utcnow() + expires_delta,
        "iat": datetime.utcnow(),
        "sub": str(anon_id), # Use 'sub' (subject) for the anon_id
        "role": role_str     # <-- FIX: Use the dynamic role
    }
    
    token = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm="HS256"
    )
    return token

# --- Part 3: Anonymous Token Verification ---

class AnonTokenPayload(BaseModel):
    """Pydantic model for our anonymous token's payload"""
    sub: str  # The anon_id
    role: str
    exp: int
    iat: int

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

def decode_anonymous_token(token: str = Depends(oauth2_scheme)) -> AnonTokenPayload:
    """
    A FastAPI dependency that verifies and decodes our internal anonymous JWT.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=["HS256"],
        )
        token_data = AnonTokenPayload(**payload)
        return token_data
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Anonymous token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (jwt.PyJWTError, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate anonymous credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_anon_user(
    payload: AnonTokenPayload = Depends(decode_anonymous_token),
    db: Session = Depends(get_db)
) -> UserAnon:
    """
    A dependency to get the current user from the database
    using the anon_id from the verified token.
    """
    try:
        anon_id = uuid.UUID(payload.sub)
    except ValueError:
        raise HTTPException(
            status_code=401, 
            detail="Invalid anonymous token payload"
        )
        
    user = db.query(UserAnon).filter(UserAnon.anon_id == anon_id).first()
    
    if user is None:
        raise HTTPException(
            status_code=401, 
            detail="Anonymous user not found"
        )
    
    return user

# --- Part 4: Optional Auth Dependencies ---

oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)

def decode_anonymous_token_optional(
    token: Optional[str] = Depends(oauth2_scheme_optional)
) -> Optional[AnonTokenPayload]:
    """
    A dependency that verifies a token if provided, but returns None if not.
    """
    if not token:
        return None
        
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=["HS256"],
        )
        return AnonTokenPayload(**payload)
    except (jwt.PyJWTError, TypeError, ValueError):
        return None

def get_current_anon_user_optional(
    payload: Optional[AnonTokenPayload] = Depends(decode_anonymous_token_optional),
    db: Session = Depends(get_db)
) -> Optional[UserAnon]:
    """
    A dependency to get the current user if they are logged in,
    or None if they are not.
    """
    if not payload:
        return None
        
    try:
        anon_id = uuid.UUID(payload.sub)
    except ValueError:
        return None
        
    user = db.query(UserAnon).filter(UserAnon.anon_id == anon_id).first()
    
    return user