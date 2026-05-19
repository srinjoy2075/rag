from sentence_transformers import CrossEncoder


reranker_model = CrossEncoder(
    "cross-encoder/ms-marco-MiniLM-L-6-v2"
)


def rerank(query, retrieved_docs, top_k=5):

    pairs = []

    for doc in retrieved_docs:

        pairs.append(
            [query, doc["text"]]
        )

    scores = reranker_model.predict(pairs)

    reranked = []

    for doc, score in zip(retrieved_docs, scores):

        doc["rerank_score"] = float(score)

        reranked.append(doc)

    reranked.sort(
        key=lambda x: x["rerank_score"],
        reverse=True
    )

    return reranked[:top_k]