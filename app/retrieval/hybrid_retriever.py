from app.retrieval.retriever import retrieve
from app.retrieval.bm25_retriever import bm25_retrieve


def hybrid_retrieve(query):

    dense_results = retrieve(query)

    bm25_results = bm25_retrieve(query)

    return {
        "dense": dense_results,
        "bm25": bm25_results
    }