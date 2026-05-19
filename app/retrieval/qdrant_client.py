from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

from app.utils.config import (
    COLLECTION_NAME,
    QDRANT_PATH
)

client = QdrantClient(path=QDRANT_PATH)


def create_collection(vector_size):

    collections = client.get_collections().collections
    existing = [c.name for c in collections]

    if COLLECTION_NAME not in existing:

        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(
                size=vector_size,
                distance=Distance.COSINE
            )
        )

    print("Collection ready")