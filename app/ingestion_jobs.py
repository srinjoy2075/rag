"""In-memory ingestion job tracking for upload → index progress polling."""

from __future__ import annotations

import threading
import time
import uuid
from pathlib import Path
from typing import Any

from app.corpus_state import update_document
from app.ingestion.runtime_ingest import ingest_pdf_file

_lock = threading.Lock()
_jobs: dict[str, dict[str, Any]] = {}

_STAGE_DEFS = [
    ("parsing", "Parsing PDF"),
    ("chunking", "Chunking document"),
    ("embedding", "Generating embeddings"),
    ("bm25", "Building BM25 index"),
    ("qdrant", "Uploading to Qdrant"),
    ("ready", "Ready for querying"),
]


def _empty_stages() -> list[dict[str, Any]]:
    return [
        {"key": k, "label": lab, "status": "pending"}
        for k, lab in _STAGE_DEFS
    ]


def create_job(document_id: str) -> str:
    job_id = str(uuid.uuid4())
    with _lock:
        _jobs[job_id] = {
            "id": job_id,
            "document_id": document_id,
            "status": "queued",
            "stages": _empty_stages(),
            "error": None,
            "result": None,
            "created_at": time.time(),
            "updated_at": time.time(),
        }
    return job_id


def get_job(job_id: str) -> dict[str, Any] | None:
    with _lock:
        j = _jobs.get(job_id)
        if not j:
            return None
        out = dict(j)
        out["stages"] = [dict(s) for s in j["stages"]]
        return out


def _update_job_unlocked(job_id: str, **kwargs: Any) -> None:
    if job_id not in _jobs:
        return
    _jobs[job_id].update(kwargs)
    _jobs[job_id]["updated_at"] = time.time()


def run_ingest_job(job_id: str, document_id: str, file_path: Path, filename: str) -> None:
    with _lock:
        if job_id in _jobs:
            _jobs[job_id]["status"] = "running"

    def on_stage(key: str, label: str, status: str) -> None:
        with _lock:
            job = _jobs.get(job_id)
            if not job:
                return
            for s in job["stages"]:
                if s["key"] == key:
                    s["status"] = "running" if status == "running" else "completed"
                    s["label"] = label
                    s["at"] = time.time()
                    break
            _update_job_unlocked(job_id)

    try:
        result = ingest_pdf_file(
            file_path,
            document_id=document_id,
            filename=filename,
            on_stage=on_stage,
        )
        with _lock:
            _update_job_unlocked(
                job_id,
                status="completed",
                result=result,
                error=None,
            )
    except Exception as e:
        update_document(document_id, status="failed", error=str(e))
        with _lock:
            _update_job_unlocked(
                job_id,
                status="failed",
                error=str(e),
            )
