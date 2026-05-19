from app.retrieval.hybrid_retriever import hybrid_retrieve


query = "What is machine learning?"

results = hybrid_retrieve(query)

print("\nDENSE RESULTS\n")

for r in results["dense"]:

    print(r["score"])
    print(r["text"][:200])


print("\nBM25 RESULTS\n")

for r in results["bm25"]:

    print(r["score"])
    print(r["text"][:200])