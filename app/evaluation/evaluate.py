from app.retrieval.retriever import retrieve


queries = [
    "What is machine learning?",
    "Explain neural networks"
]

for query in queries:

    print(f"\nQUERY: {query}")

    results = retrieve(query)

    for r in results:

        print("\nSCORE:", r["score"])
        print(r["text"][:300])