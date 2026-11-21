"""
AspectIQ 2.0 — Modular FastAPI Service Layer & Evaluation Utilities
"""

import os
from typing import Dict, List
from google import genai
from google.genai import types


def get_genai_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or api_key == "MY_GEMINI_API_KEY":
        raise RuntimeError("GEMINI_API_KEY environment variable is not configured.")
    return genai.Client(api_key=api_key)


def compute_classification_report(y_true: List[str], y_pred: List[str]) -> Dict[str, object]:
    from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support

    labels = sorted(list(set(y_true) | set(y_pred)))
    acc = round(float(accuracy_score(y_true, y_pred)) * 100, 2)
    prec, rec, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, labels=labels, average="macro", zero_division=0
    )
    cm = confusion_matrix(y_true, y_pred, labels=labels).tolist()
    return {
        "labels": labels,
        "accuracy": acc,
        "precisionMacro": round(float(prec) * 100, 2),
        "recallMacro": round(float(rec) * 100, 2),
        "f1Macro": round(float(f1) * 100, 2),
        "confusionMatrix": cm,
    }


async def analyze_statement_with_gemini(statement_id: str, text: str) -> str:
    client = get_genai_client()
    response = client.models.generate_content(
        model="gemini-3.1-flash-lite",
        contents=f"Analyze statement ({statement_id}): {text}",
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            system_instruction=(
                "Return domain-independent sentiment, commentTypes, tone, emotion, "
                "communicationIntent, dynamic aspects (no pronouns), sarcasm, negation, and interpretation."
            ),
        ),
    )
    return response.text or "{}"
