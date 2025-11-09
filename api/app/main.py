# File: api/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# --- ADD THIS IMPORT ---
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from .core.storage import setup_cloudinary

# Import all your components
from .core.config import settings
from .api import auth, events, vibes, ws, photos, rsvp, chat, ai, spaces, profile, admin

# --- App Initialization (UPDATED) ---
app = FastAPI(
    title="SBU VibeCheck API",
    description="Backend for the SBUHacks 2025 VibeCheck project.",
    # This tells FastAPI to generate URLs using https
    # when it's behind a proxy (like Cloud Run)
    root_path="/", 
    root_path_in_servers=False,
    docs_url="/docs",
    redoc_url="/redoc"
)

# --- Call Setup on Startup ---
setup_cloudinary()

# --- Add Proxy Middleware ---
# This tells FastAPI to trust the X-Forwarded- headers
# sent by Google's load balancer.
app.add_middleware(
    TrustedHostMiddleware, allowed_hosts=["*"]
)
# --- END OF ADDED MIDDLEWARE ---

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods
    allow_headers=["*"],  # Allows all headers
)

# --- Include All Routers ---
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(events.router, prefix="/events", tags=["Events"])
app.include_router(vibes.router, prefix="/vibes", tags=["Vibes"])
app.include_router(ws.router, prefix="/ws", tags=["WebSockets"])
app.include_router(rsvp.router, prefix="/rsvp", tags=["RSVP"])
app.include_router(chat.router, prefix="/chat", tags=["Chat"])
app.include_router(photos.router, prefix="/photos", tags=["Photos"])
app.include_router(ai.router, prefix="/ai", tags=["AI"])
app.include_router(spaces.router, prefix="/spaces", tags=["Spaces"])
app.include_router(profile.router, prefix="/profile", tags=["Profile"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])

# --- Root & Health EndPoints ---
@app.get("/")
def read_root():
    return {"message": "SBU VibeCheck API is running!"}

@app.get("/health")
def health_check():
    return {"status": "ok"}