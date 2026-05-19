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

        retrieved_chunks.append({
            "score": result.score,
            "text": result.payload["text"],
            "source": result.payload["source"]
        })

    return retrieved_chunks