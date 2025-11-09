# File: api/app/core/storage.py
import cloudinary
from app.core.config import settings

def setup_cloudinary():
    """
    Initializes the Cloudinary SDK with our credentials.
    """
    cloudinary.config(
        cloud_name = settings.CLOUDINARY_CLOUD_NAME,
        api_key = settings.CLOUDINARY_API_KEY,
        api_secret = settings.CLOUDINARY_API_SECRET,
        secure=True # Always use HTTPS
    )
    print("Cloudinary SDK initialized.")