# File: api/app/schemas.py
from pydantic import BaseModel, ConfigDict, field_validator
from pydantic import constr
import uuid
from datetime import datetime
from typing import List, Optional
# Import *all* your enums
from app.models import (
    VibeTargetEnum, 
    WorthItRatingEnum,  # <-- CHANGED
    RSVPStatusEnum, RSVPVisibilityEnum,
    PhotoStatusEnum, RoleEnum, VibeRatingEnum
)
from app.models import PhotoStatusEnum
from pydantic import conint # <-- Import conint for number ranges

class TokenRequest(BaseModel):
    # This is the token Person B gets from Auth0
    access_token: str

class TokenResponse(BaseModel):
    # This is the anonymous token you will mint
    anonymous_token: str

class AnonUser(BaseModel):
    anon_id: uuid.UUID

    class Config:
        from_attributes = True # (was orm_mode)
        
# --- Vibe Schemas (FIXED) ---
        
class VibeCreate(BaseModel):
    """Data required to submit a new vibe."""
    target_type: VibeTargetEnum
    target_id: uuid.UUID
    
    # Q1 (for Events) - as per frontend dev's request
    answer_1: Optional[str] = None # e.g., "👍 Worth it"
    # Q2 (for Events)
    answer_2: Optional[str] = None # e.g., "🟢 Open"
    
    # Old system (for Spaces)
    rating_enum: Optional[VibeRatingEnum] = None
    food_rating: Optional[int] = None
    crowd_rating: Optional[int] = None
    queue_rating: Optional[int] = None

class VibePublic(BaseModel):
    """The data for a single Vibe record, returned after creation."""
    id: uuid.UUID
    anon_id: uuid.UUID
    target_type: VibeTargetEnum
    target_id: uuid.UUID
    ts: datetime
    
    # New fields
    worth_it_rating: WorthItRatingEnum
    contextual_answer: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class VibeSummary(BaseModel):
    """The aggregated vibe summary for an event or space."""
    target_id: uuid.UUID
    target_type: VibeTargetEnum
    count: int
    
    # "avg_rating" is now the average "worth it" score (1-3)
    avg_rating: Optional[float] = None
    trend: float
    
    # The slider averages are GONE
    # avg_food: Optional[float] = None
    # avg_crowd: Optional[float] = None
    # avg_queue: Optional[float] = None
    

class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    location_name: str
    location_lat: Optional[float] = None
    location_lon: Optional[float] = None
    tags: Optional[List[str]] = []
    image_url: Optional[str] = None  # <- add this

class EventPublic(BaseModel):
    """Data for an event returned to the public."""
    id: uuid.UUID
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    location_name: str
    location_lat: Optional[float] = None
    location_lon: Optional[float] = None
    tags: Optional[List[str]] = []
    image_url: Optional[str] = None

    vibe_question_1_text: str
    vibe_question_1_options: List[str]
    vibe_question_2_text: Optional[str] = None
    vibe_question_2_options: Optional[List[str]] = None

    # This tells Pydantic to read data even if it's an ORM model
    model_config = ConfigDict(from_attributes=True)

class RSVPCreate(BaseModel):
    """Data required to create/update an RSVP."""
    event_id: uuid.UUID
    status: RSVPStatusEnum  # "going", "interested", "not_interested"
    visibility: RSVPVisibilityEnum = RSVPVisibilityEnum.private # Default to private

class RSVPPublic(BaseModel):
    """The full RSVP object returned to the user."""
    id: uuid.UUID
    event_id: uuid.UUID
    anon_id: uuid.UUID
    status: RSVPStatusEnum
    visibility: RSVPVisibilityEnum
    ts: datetime

    model_config = ConfigDict(from_attributes=True)

class RSVPCounts(BaseModel):
    """Aggregated counts for an event."""
    going: int
    interested: int

class RSVPSummary(BaseModel):
    """
    Full RSVP summary for an event, including total counts
    and the current user's status (if logged in).
    """
    counts: RSVPCounts
    user_status: Optional[RSVPStatusEnum] = None
    user_visibility: Optional[RSVPVisibilityEnum] = None

class ChatMessageCreate(BaseModel):
    """Data required to send a new chat message."""
    # Add validation: message must be 1-500 chars
    message: constr(strip_whitespace=True, min_length=1, max_length=500)

class ChatMessagePublic(BaseModel):
    """The full chat message object returned to the client."""
    id: uuid.UUID
    channel: str
    anon_id: uuid.UUID
    message: str
    ts: datetime
    moderation_flag: bool

    model_config = ConfigDict(from_attributes=True)

class PhotoSignRequest(BaseModel):
    target_type: VibeTargetEnum
    target_id: Optional[uuid.UUID] = None

class PhotoSignResponse(BaseModel):
    """The signature and data needed for the frontend to upload."""
    signature: str
    timestamp: int
    api_key: str
    cloud_name: str

class PhotoConfirmRequest(BaseModel):
    target_type: VibeTargetEnum
    target_id: Optional[uuid.UUID] = None
    url: str
    nsfw_score_client: Optional[float] = 0.0
    

class PhotoPublic(BaseModel):
    """The final Photo object as it exists in our DB."""
    id: uuid.UUID
    target_type: VibeTargetEnum
    target_id: uuid.UUID
    anon_id: uuid.UUID
    url: str
    nsfw_score: Optional[float] = None
    status: PhotoStatusEnum
    ts: datetime

    model_config = ConfigDict(from_attributes=True)
    
class ConversationMessage(BaseModel):
    """A single message in the conversation history."""
    role: str  # "user" or "bot"
    content: str

class AIQueryRequest(BaseModel):
    """Data sent from the user (their chat message)."""
    text: str
    
    # Optional context (as per your plan)
    lat: Optional[float] = None
    lon: Optional[float] = None
    
    # NEW: Conversation history for context-aware responses
    conversation_history: Optional[List[ConversationMessage]] = []

class AIEventCard(BaseModel):
    """Lightweight event card for AI chat responses (no UUID required)."""
    id: str  # URL or slug — used as React key and link target
    title: str
    description: Optional[str] = ""
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location_name: Optional[str] = ""
    tags: List[str] = []
    image_url: Optional[str] = ""

class AIQueryResponse(BaseModel):
    """The rich response from the AI."""
    text_response: str
    events: List[AIEventCard] = []
    

class SpacePublic(BaseModel):
    """Public data for a pre-seeded campus space."""
    id: uuid.UUID
    name: str
    type: str
    lat: Optional[float] = None
    lon: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)

class ProfileUpdate(BaseModel):
    """Data a user can send to update their profile."""
    # Regex allows letters, numbers, and underscores
    username: Optional[constr(
        strip_whitespace=True, 
        min_length=3, 
        max_length=20, 
        pattern=r"^[a-zA-Z0-9_]+$"
    )] = None # type: ignore
    
    display_name: Optional[constr(
        strip_whitespace=True, 
        min_length=1, 
        max_length=50
    )] = None # type: ignore
    
    bio: Optional[constr(
        strip_whitespace=True, 
        max_length=250
    )] = None # type: ignore
    
    profile_image_url: Optional[str] = None

class ProfilePublic(BaseModel):
    """The public-facing user profile."""
    username: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    created_ts: datetime

    model_config = ConfigDict(from_attributes=True)

class FeedbackCreate(BaseModel):
    """Data required to create new feedback."""
    rating: conint(ge=1, le=5) # Constrained integer (1-5)
    review: Optional[constr(strip_whitespace=True, max_length=1000)] = None

class FeedbackAuthor(BaseModel):
    """Public info about a feedback author."""
    username: str
    profile_image_url: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class FeedbackPublic(BaseModel):
    """Public-facing feedback, including author's public profile."""
    id: uuid.UUID
    event_id: uuid.UUID
    rating: int
    review: Optional[str] = None
    ts: datetime
    author: Optional[FeedbackAuthor] = None # Nested author info

    model_config = ConfigDict(from_attributes=True)