from rank_bm25 import BM25Okapi

from app.ingestion.loader import load_documents
from app.ingestion.chunking_strategy import chunk_documents


documents = load_documents()

chunks = chunk_documents(
    documents,
    strategy="fixed",
    chunk_size=500,
    chunk_overlap=50
)

chunk_texts = [
    chunk.page_content for chunk in chunks
]

tokenized_corpus = [
    text.split() for text in chunk_texts
]

bm25 = BM25Okapi(tokenized_corpus)


def bm25_retrieve(query, top_k=5):

    tokenized_query = query.split()

    scores = bm25.get_scores(tokenized_query)

    ranked = sorted(
        zip(chunk_texts, scores),
        key=lambda x: x[1],
        reverse=True
    )

    results = []

    for text, score in ranked[:top_k]:

        results.append({
            "score": float(score),
            "text": text
        })

    return results