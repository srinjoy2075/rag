from uuid import uuid4
from qdrant_client.models import PointStruct
from app.ingestion.loader import load_documents
from app.ingestion.chunking_strategy import chunk_documents
from app.ingestion.embedder import generate_embeddings

from app.retrieval.qdrant_client import (
    client,
    create_collection
)

from app.utils.config import COLLECTION_NAME


def run_pipeline():

    print("Loading documents...")
    documents = load_documents()

    print("Chunking documents...")
    chunks = chunk_documents(
    documents,
    strategy="fixed",
    chunk_size=500,
    chunk_overlap=50
)

    texts = [chunk.page_content for chunk in chunks]

    print("Generating embeddings...")
    embeddings = generate_embeddings(texts)

    vector_size = len(embeddings[0])

    create_collection(vector_size)

    points = []

    for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings)):

        points.append(
    PointStruct(
        id=str(uuid4()),
        vector=embedding.tolist(),
        payload={
            "text": chunk.page_content,
            "source": chunk.metadata.get("source", "unknown")
        }
    )
)

    print("Uploading to Qdrant...")

    client.upsert(
        collection_name=COLLECTION_NAME,
        points=points
    )

    print("Pipeline completed successfully")


if __name__ == "__main__":
    run_pipeline()