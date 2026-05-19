from app.retrieval.hybrid_fusion_retriever import hybrid_search
from app.retrieval.reranker import rerank


def production_retrieve(query):

    retrieved_docs = hybrid_search(query)

    reranked_docs = rerank(
        query,
        retrieved_docs,
        top_k=5
    )

    return reranked_docs