from app.retrieval.hybrid_fusion_retriever import hybrid_search


query = "What is machine learning?"

results = hybrid_search(query)

for r in results[:5]:

    print("\nRRF SCORE:", r["rrf_score"])

    print(r["text"][:300])