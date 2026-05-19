from app.rag_pipeline import ask

test_queries = [
    "What is machine learning?",
    "What is deep learning?"
]

for query in test_queries:

    result = ask(query)

    print("\nQUESTION:")
    print(query)

    print("\nANSWER:")
    print(result["answer"])

    print("\nRETRIEVED CHUNKS:")
    
    for doc in result["sources"]:

        print(doc["text"][:200])

    print("\n" + "="*50)