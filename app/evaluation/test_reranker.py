from app.retrieval.production_retriever import production_retrieve


query = "What is machine learning?"

results = production_retrieve(query)

for r in results:

    print("\nRERANK SCORE:", r["rerank_score"])

    print(r["text"][:300])