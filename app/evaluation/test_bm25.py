from app.retrieval.bm25_retriever import bm25_retrieve


query = "What is machine learning?"

results = bm25_retrieve(query)

for r in results:

    print("\nSCORE:", r["score"])
    print(r["text"][:300])