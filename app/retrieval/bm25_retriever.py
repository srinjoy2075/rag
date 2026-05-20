from __future__ import annotations

from app.corpus_state import get_bm25, get_chunks_snapshot


def bm25_retrieve(query: str, top_k: int = 5) -> list[dict]:
    bm25 = get_bm25()
    chunks = get_chunks_snapshot()
    if bm25 is None or not chunks:
        return []

    tokenized_query = query.split()
    scores = bm25.get_scores(tokenized_query)
    ranked = sorted(
        enumerate(scores),
        key=lambda x: x[1],
        reverse=True,
    )[:top_k]

    results: list[dict] = []
    for idx, score in ranked:
        row = dict(chunks[idx])
        row["score"] = float(score)
        row["retrieval_channel"] = "bm25"
        results.append(row)

    return results
