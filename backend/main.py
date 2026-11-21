"""
AspectIQ 2.0 — FastAPI Application Entry Point
Standalone Python backend mirroring the Express API endpoints.
Run locally with: uvicorn backend.main:app --reload --port 8000
"""

import json
import os
import time
from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from backend.models.schemas import AnalyzeStatementRequest, FeedbackRequest
from backend.services.nlp_service import analyze_statement_with_gemini
from backend.storage.database import AnalysisHistoryORM, PredictionFeedbackORM, SessionLocal, init_db

app = FastAPI(
    title="AspectIQ 2.0 NLP Intelligence API",
    version="2.0.0",
    description="Domain-independent NLP Intelligence, ABSA, Conversation, Semantic Search, and Model Evaluation API.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter(prefix="/api")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@router.get("/health")
async def health_check():
    key_set = bool(os.getenv("GEMINI_API_KEY", "").strip())
    return {
        "status": "ok",
        "backend": "FastAPI",
        "inferenceReady": key_set,
        "providerName": "Google Gemini API (gemini-3.1-flash-lite)",
        "isApiBased": True,
    }


@router.post("/analyze")
async def analyze_statement(payload: AnalyzeStatementRequest):
    try:
        raw_json = await analyze_statement_with_gemini("STMT-1", payload.text.strip())
        parsed = json.loads(raw_json)
        analysis_id = f"ANL-{int(time.time() * 1000)}"
        db = SessionLocal()
        try:
            record = AnalysisHistoryORM(
                id=analysis_id,
                source_type="statement",
                input_preview=payload.text.strip(),
                overall_sentiment=parsed.get("overallSentiment", "Neutral"),
                comment_types_json=json.dumps(parsed.get("commentTypes", ["Other / Uncertain"])),
                main_aspects_json=json.dumps([]),
                status="Completed",
                payload_json=json.dumps(parsed),
            )
            db.add(record)
            db.commit()
        finally:
            db.close()
        return {"ok": True, "analysisId": analysis_id, "result": parsed}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/feedback")
async def submit_feedback(payload: FeedbackRequest):
    db = SessionLocal()
    try:
        fb = PredictionFeedbackORM(
            id=f"FB-{int(time.time() * 1000)}",
            analysis_id=payload.analysisId,
            input_text=payload.inputText[:1000],
            predicted_sentiment=payload.predictedSentiment,
            is_correct=payload.isCorrect,
            reported_issue=payload.reportedIssue,
            notes=payload.notes,
        )
        db.add(fb)
        db.commit()
        return {"ok": True, "feedbackId": fb.id}
    finally:
        db.close()


app.include_router(router)
