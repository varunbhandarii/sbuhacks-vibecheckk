# File: api/app/api/chat.py
from fastapi import APIRouter, Depends, HTTPException, status, Path, Query
from sqlalchemy.orm import Session
from typing import List

from app.dependencies import get_db
from app.models import Chat, UserAnon
from app.schemas import ChatMessageCreate, ChatMessagePublic
from app.core.auth_utils import get_current_anon_user

from app.websocket_manager import manager
from app.schemas import ChatMessagePublic  # Ensure this is imported

router = APIRouter()

# We'll add a basic profanity filter.
# For a hackathon, a simple set is fine.
# In production, you'd use a real library.
PROFANITY_LIST = {"badword1", "badword2", "badword3"}

def check_profanity(message: str) -> bool:
    """Simple profanity check."""
    words = set(message.lower().split())
    return any(word in PROFANITY_LIST for word in words)

@router.get("/{channel}", response_model=List[ChatMessagePublic])
def get_chat_history(
    channel: str = Path(..., description="The channel to fetch messages for (e.g., 'global' or 'event:uuid')"),
    limit: int = Query(50, description="How many messages to retrieve", ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Gets the most recent chat history for a channel.
    This endpoint is public.
    """
    messages = db.query(Chat).filter(
        Chat.channel == channel
    ).order_by(
        Chat.ts.desc()  # Get the newest messages first
    ).limit(
        limit
    ).all()
    
    # Reverse the list so it's in chronological order (oldest to newest)
    return list(reversed(messages))

# --- THIS IS THE UPDATED FUNCTION ---
@router.post("/{channel}", response_model=ChatMessagePublic, status_code=status.HTTP_201_CREATED)
async def post_chat_message(  # <-- CHANGED TO ASYNC
    chat_data: ChatMessageCreate,
    channel: str = Path(..., description="The channel to post to (e.g., 'global' or 'event:uuid')"),
    db: Session = Depends(get_db),
    current_user: UserAnon = Depends(get_current_anon_user)
):
    """
    Posts a new message to a channel AND broadcasts it.
    Requires a valid anonymous student token.
    """
    
    # Simple moderation check
    is_flagged = check_profanity(chat_data.message)

    new_message = Chat(
        channel=channel,
        anon_id=current_user.anon_id,
        message=chat_data.message,
        moderation_flag=is_flagged
    )
    
    try:
        db.add(new_message)
        db.commit()
        db.refresh(new_message)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send message: {e}"
        )
        
    # --- ADDED BROADCAST LOGIC ---
    # Convert the ORM model to a Pydantic model, then to a dict
    broadcast_data = ChatMessagePublic.model_validate(new_message).model_dump(mode='json')    
    # Broadcast the new message data to the channel
    await manager.broadcast(channel, broadcast_data)
    # --- END OF BROADCAST LOGIC ---
        
    # Return the new message as the HTTP response
    return new_message