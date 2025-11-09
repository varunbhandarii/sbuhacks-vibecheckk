# File: api/app/api/spaces.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.dependencies import get_db
from app.models import Space
from app.schemas import SpacePublic

router = APIRouter()

@router.get("/", response_model=List[SpacePublic])
def get_all_spaces(db: Session = Depends(get_db)):
    """
    Gets the list of all pre-seeded campus spaces
    (libraries, dining, gyms, etc.).
    """
    spaces = db.query(Space).order_by(Space.type, Space.name).all()
    return spaces