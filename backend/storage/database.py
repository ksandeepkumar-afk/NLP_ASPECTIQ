"""
AspectIQ 2.0 — Database Abstraction Layer (SQLite default, PostgreSQL-ready via DATABASE_URL)
"""

import os
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./.data/aspectiq_py.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class AnalysisHistoryORM(Base):
    __tablename__ = "analysis_history"
    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    source_type = Column(String, nullable=False)
    input_preview = Column(Text, nullable=False)
    overall_sentiment = Column(String, nullable=False)
    comment_types_json = Column(Text, nullable=False)
    main_aspects_json = Column(Text, nullable=False)
    status = Column(String, nullable=False, default="Completed")
    payload_json = Column(Text, nullable=False)


class PredictionFeedbackORM(Base):
    __tablename__ = "prediction_feedback"
    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    analysis_id = Column(String, nullable=False)
    input_text = Column(Text, nullable=False)
    predicted_sentiment = Column(String, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    reported_issue = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)


def init_db() -> None:
    os.makedirs(".data", exist_ok=True)
    Base.metadata.create_all(bind=engine)
