from app.retrieval.production_retriever import production_retrieve
from app.llm.generator import generate_answer


def ask(query):

    retrieved_docs = production_retrieve(query)

    answer = generate_answer(
        query,
        retrieved_docs
    )

    return {
        "query": query,
        "answer": answer,
        "sources": retrieved_docs
    }