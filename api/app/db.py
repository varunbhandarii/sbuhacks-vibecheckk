# File: app/db.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

from app.core.config import settings

# Create the SQLAlchemy engine
# pool_pre_ping=True checks for "dead" connections before using them
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True
)

# Each instance of SessionLocal will be a new database session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for our models to inherit from
# This is what Alembic (Task 1.3) will use to find the models
Base = declarative_base()