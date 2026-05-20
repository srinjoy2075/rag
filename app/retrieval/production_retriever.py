from app.retrieval.retriever import retrieve
from app.retrieval.bm25_retriever import bm25_retrieve
from app.retrieval.rrf_fusion import reciprocal_rank_fusion
from app.retrieval.reranker import rerank


def production_retrieve(query, top_k=5, reranker_enabled=True, retrieval_mode="hybrid"):
    
    trace = {
        "dense": [],
        "bm25": [],
        "fusion": [],
        "reranked": []
    }

    if retrieval_mode in ["hybrid", "dense"]:
        dense_results = retrieve(query)
        trace["dense"] = dense_results
    else:
        dense_results = []

    if retrieval_mode in ["hybrid", "bm25"]:
        sparse_results = bm25_retrieve(query)
        trace["bm25"] = sparse_results
    else:
        sparse_results = []

    if retrieval_mode == "hybrid":
        fused_results = reciprocal_rank_fusion([dense_results, sparse_results])
        trace["fusion"] = fused_results
        current_docs = fused_results
    elif retrieval_mode == "dense":
        current_docs = dense_results
    else:
        current_docs = sparse_results

    if reranker_enabled:
        reranked_docs = rerank(query, current_docs, top_k=top_k)
        trace["reranked"] = reranked_docs
        final_docs = reranked_docs
    else:
        final_docs = current_docs[:top_k]

    return final_docs, trace