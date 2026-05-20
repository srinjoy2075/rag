"""
Runtime PDF ingestion for user uploads (single document).
"""

from __future__ import annotations

import time
from pathlib import Path
from uuid import uuid4

from langchain_community.document_loaders import PyPDFLoader
from qdrant_client.models import PointStruct

from app.corpus_state import replace_document_vectors, update_document
from app.ingestion.chunking_strategy import chunk_documents
from app.ingestion.embedder import generate_embeddings
from app.retrieval.qdrant_client import client, create_collection
from app.utils.config import COLLECTION_NAME, EMBEDDING_MODEL_NAME


def _delete_document_points(document_id: str) -> None:
    from qdrant_client import models

    try:
        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="document_id",
                            match=models.MatchValue(value=document_id),
                        )
                    ]
                )
            ),
        )
    except Exception:
        # Collection may not exist yet
        pass


def ingest_pdf_file(
    file_path: Path,
    document_id: str,
    filename: str,
    on_stage=None,
) -> dict:
    """
    Parse, chunk, embed, upsert Qdrant, refresh BM25 corpus for one PDF.

    on_stage: optional callable(stage_key: str, label: str, status: str) -> None
    """
    t0 = time.perf_counter()

    def stage(key: str, label: str, status: str) -> None:
        if on_stage:
            on_stage(key, label, status)

    stage("parsing", "Parsing PDF", "running")
    loader = PyPDFLoader(str(file_path))
    documents = loader.load()
    page_count = 0
    if documents:
        pages = [d.metadata.get("page", 0) for d in documents]
        page_count = int(max(pages)) + 1
    stage("parsing", "Parsing PDF", "completed")

    stage("chunking", "Chunking document", "running")
    chunks = chunk_documents(
        documents,
        strategy="fixed",
        chunk_size=500,
        chunk_overlap=50,
    )
    texts = [c.page_content for c in chunks]
    stage("chunking", "Chunking document", "completed")

    stage("embedding", "Generating embeddings", "running")
    embeddings = generate_embeddings(texts)
    vector_size = len(embeddings[0])
    stage("embedding", "Generating embeddings", "completed")

    stage("bm25", "Building BM25 index", "running")
    _delete_document_points(document_id)

    create_collection(vector_size)

    points: list[PointStruct] = []
    corpus_records: list[dict] = []

    for chunk, embedding in zip(chunks, embeddings):
        point_id = str(uuid4())
        page = chunk.metadata.get("page")
        if page is not None:
            page = int(page)
        source = chunk.metadata.get("source") or str(file_path)
        payload = {
            "text": chunk.page_content,
            "source": source,
            "page": page,
            "chunk_id": point_id,
            "document_id": document_id,
            "filename": filename,
        }
        points.append(
            PointStruct(
                id=point_id,
                vector=embedding.tolist(),
                payload=payload,
            )
        )
        corpus_records.append(
            {
                "chunk_id": point_id,
                "text": chunk.page_content,
                "source": source,
                "page": page,
                "document_id": document_id,
                "filename": filename,
            }
        )

    replace_document_vectors(document_id, corpus_records)
    stage("bm25", "Building BM25 index", "completed")

    stage("qdrant", "Uploading to Qdrant", "running")
    client.upsert(collection_name=COLLECTION_NAME, points=points)
    stage("qdrant", "Uploading to Qdrant", "completed")

    stage("ready", "Ready for querying", "completed")

    duration_ms = int((time.perf_counter() - t0) * 1000)

    update_document(
        document_id,
        status="ready",
        page_count=page_count,
        chunk_count=len(points),
        embedding_model=EMBEDDING_MODEL_NAME,
        ingestion_duration_ms=duration_ms,
        error=None,
    )

    return {
        "document_id": document_id,
        "page_count": page_count,
        "chunk_count": len(points),
        "embedding_model": EMBEDDING_MODEL_NAME,
        "ingestion_duration_ms": duration_ms,
    }
