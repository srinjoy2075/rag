"""
In-memory corpus + document registry synchronized with Qdrant and BM25.

Rebuilt on ingest; optionally bootstrapped from Qdrant on API startup.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Any

from rank_bm25 import BM25Okapi

from app.retrieval.qdrant_client import client
from app.utils.config import COLLECTION_NAME

_lock = threading.Lock()

_chunks: list[dict[str, Any]] = []
_bm25: BM25Okapi | None = None


@dataclass
class DocumentRecord:
    document_id: str
    filename: str
    file_path: str
    status: str = "uploaded"  # uploaded | indexing | ready | failed
    page_count: int = 0
    chunk_count: int = 0
    embedding_model: str | None = None
    ingestion_duration_ms: int | None = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    error: str | None = None


_documents: dict[str, DocumentRecord] = {}


def _rebuild_bm25_unlocked() -> None:
    global _bm25
    if not _chunks:
        _bm25 = None
        return
    tokenized = [c["text"].split() for c in _chunks]
    _bm25 = BM25Okapi(tokenized)


def get_bm25() -> BM25Okapi | None:
    with _lock:
        return _bm25


def get_chunks_snapshot() -> list[dict[str, Any]]:
    with _lock:
        return [dict(c) for c in _chunks]


def replace_document_vectors(
    document_id: str,
    records: list[dict[str, Any]],
) -> None:
    """Replace all in-memory chunks for a document and rebuild BM25."""
    global _chunks
    with _lock:
        _chunks = [c for c in _chunks if c.get("document_id") != document_id]
        _chunks.extend(records)
        _rebuild_bm25_unlocked()


def set_chunks_from_bootstrap(records: list[dict[str, Any]]) -> None:
    global _chunks
    with _lock:
        _chunks = list(records)
        _rebuild_bm25_unlocked()


def upsert_document_record(rec: DocumentRecord) -> None:
    with _lock:
        _documents[rec.document_id] = rec


def get_document(document_id: str) -> DocumentRecord | None:
    with _lock:
        return _documents.get(document_id)


def list_documents() -> list[DocumentRecord]:
    with _lock:
        return sorted(_documents.values(), key=lambda d: d.created_at, reverse=True)


def update_document(
    document_id: str,
    **kwargs: Any,
) -> DocumentRecord | None:
    with _lock:
        doc = _documents.get(document_id)
        if not doc:
            return None
        for k, v in kwargs.items():
            if hasattr(doc, k):
                setattr(doc, k, v)
        doc.updated_at = time.time()
        return doc


def bootstrap_from_qdrant() -> int:
    """Load all points from Qdrant into BM25 corpus. Returns number of chunks."""
    try:
        collections = client.get_collections().collections
        if COLLECTION_NAME not in [c.name for c in collections]:
            return 0
    except Exception:
        return 0

    records: list[dict[str, Any]] = []
    offset = None
    while True:
        points, next_offset = client.scroll(
            collection_name=COLLECTION_NAME,
            limit=256,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        for p in points:
            pl = p.payload or {}
            records.append(
                {
                    "chunk_id": str(p.id),
                    "text": pl.get("text", ""),
                    "source": pl.get("source", ""),
                    "page": pl.get("page"),
                    "document_id": pl.get("document_id"),
                    "filename": pl.get("filename"),
                }
            )
        offset = next_offset
        if offset is None:
            break

    if not records:
        return 0

    set_chunks_from_bootstrap(records)

    seen_docs: dict[str, DocumentRecord] = {}
    for r in records:
        did = r.get("document_id")
        if not did:
            continue
        if did not in seen_docs:
            seen_docs[did] = DocumentRecord(
                document_id=did,
                filename=r.get("filename") or f"{did}.pdf",
                file_path="",
                status="ready",
                chunk_count=0,
            )
        seen_docs[did].chunk_count += 1

    with _lock:
        for did, rec in seen_docs.items():
            if did not in _documents:
                _documents[did] = rec

    return len(records)
