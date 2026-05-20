from app.retrieval.production_retriever import production_retrieve
from app.llm.generator import generate_answer


def ask(query, top_k=5, reranker_enabled=True, retrieval_mode="hybrid"):

    retrieved_docs, trace = production_retrieve(
        query,
        top_k=top_k,
        reranker_enabled=reranker_enabled,
        retrieval_mode=retrieval_mode
    )

    answer = generate_answer(
        query,
        retrieved_docs
    )

    return {
        "query": query,
        "answer": answer,
        "sources": retrieved_docs,
        "trace": trace
    }