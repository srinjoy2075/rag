from app.retrieval.retriever import retrieve
from app.retrieval.bm25_retriever import bm25_retrieve
from app.retrieval.rrf_fusion import reciprocal_rank_fusion


def hybrid_search(query):

    dense_results = retrieve(query)

    sparse_results = bm25_retrieve(query)

    fused_results = reciprocal_rank_fusion([
        dense_results,
        sparse_results
    ])

    return fused_results