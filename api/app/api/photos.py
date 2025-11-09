from fastapi import APIRouter, Depends, HTTPException, status, Path
from sqlalchemy.orm import Session
import time
import cloudinary
import cloudinary.utils
from typing import List
import uuid

from app.dependencies import get_db
from app.models import Photo, UserAnon, PhotoStatusEnum, VibeTargetEnum
from app.schemas import (
    PhotoSignRequest, PhotoSignResponse, 
    PhotoConfirmRequest, PhotoPublic
)
from app.core.auth_utils import get_current_anon_user
from app.core.config import settings

router = APIRouter()

@router.post("/sign", response_model=PhotoSignResponse)
def get_upload_signature(
    sign_request: PhotoSignRequest,
    current_user: UserAnon = Depends(get_current_anon_user)
):
    """
    (Step 1) Provides a "signed" signature for the client to upload to Cloudinary.
    The client must be authenticated.
    """
    timestamp = int(time.time())
    
    params_to_sign = {"timestamp": timestamp}
    tags = [str(sign_request.target_type.value)]
    if sign_request.target_id:
        tags.append(str(sign_request.target_id))
    tags_str = ",".join(tags)          # <- stringify
    params_to_sign["tags"] = tags_str  # <- sign the string
    
    try:
        signature = cloudinary.utils.api_sign_request(
            params_to_sign, 
            settings.CLOUDINARY_API_SECRET
        )
        
        return PhotoSignResponse(
            signature=signature,
            timestamp=timestamp,
            api_key=settings.CLOUDINARY_API_KEY,
            cloud_name=settings.CLOUDINARY_CLOUD_NAME
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to create upload signature: {e}"
        )

@router.post("/confirm", response_model=PhotoPublic, status_code=status.HTTP_201_CREATED)
def confirm_upload(
    confirm_data: PhotoConfirmRequest,
    db: Session = Depends(get_db),
    current_user: UserAnon = Depends(get_current_anon_user)
):
    """
    (Step 2) Confirms an upload is complete and saves the URL to our database.
    This is called *after* the client successfully uploads to Cloudinary.
    """
    
    # --- NSFW Check (Stub) ---
    nsfw_score = confirm_data.nsfw_score_client or 0.0
    status = PhotoStatusEnum.flagged if nsfw_score > 0.7 else PhotoStatusEnum.approved

    new_photo = Photo(
        target_type=confirm_data.target_type,
        # --- THIS IS UPDATED ---
        target_id=confirm_data.target_id,  # This can now be None
        # --- END OF UPDATE ---
        anon_id=current_user.anon_id,
        url=confirm_data.url,
        nsfw_score=nsfw_score,
        status=status
    )
    
    try:
        db.add(new_photo)
        db.commit()
        db.refresh(new_photo)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save photo to database: {e}"
        )
        
    return new_photo

@router.get(
    "/{target_type}/{target_id}", 
    response_model=List[PhotoPublic]
)
def get_photos_for_target(
    target_type: VibeTargetEnum = Path(..., description="Type of target (event or space)"),
    target_id: uuid.UUID = Path(..., description="UUID of the target"),
    db: Session = Depends(get_db)
):
    """
    Gets all approved photos for a specific event or space.
    """
    photos = db.query(Photo).filter(
        Photo.target_type == target_type,
        Photo.target_id == target_id,
        Photo.status == PhotoStatusEnum.approved
    ).order_by(
        Photo.ts.desc()
    ).all()
    
    return photos