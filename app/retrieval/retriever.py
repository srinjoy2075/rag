from app.utils.config import embedding_model
from app.retrieval.qdrant_client import client
from app.utils.config import COLLECTION_NAME


def retrieve(query, top_k=5):

    query_embedding = embedding_model.encode(query)

    results = client.query_points(
    collection_name=COLLECTION_NAME,
    query=query_embedding.tolist(),
    limit=top_k
).points

    retrieved_chunks = []

    for result in results:
        pl = result.payload or {}
        chunk_id = pl.get("chunk_id") or str(result.id)
        retrieved_chunks.append(
            {
                "chunk_id": chunk_id,
                "score": float(result.score) if result.score is not None else None,
                "text": pl.get("text", ""),
                "source": pl.get("source", ""),
                "page": pl.get("page"),
                "document_id": pl.get("document_id"),
                "filename": pl.get("filename"),
                "retrieval_channel": "dense",
            }
        )

    return retrieved_chunks