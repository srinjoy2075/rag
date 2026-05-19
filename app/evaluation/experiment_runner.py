from app.rag_pipeline import ask


experiments = [

    {
        "name": "baseline_fixed_chunking",
        "description": "Fixed chunking with default settings"
    },

    {
        "name": "semantic_chunking",
        "description": "Semantic chunking enabled"
    },

    {
        "name": "reranker_enabled",
        "description": "Hybrid retrieval with reranker"
    }

]


test_queries = [

    "What is machine learning?",

    "What is deep learning?",

    "What is NLP?"
]


for experiment in experiments:

    print("\n" + "=" * 100)

    print(f"\nEXPERIMENT: {experiment['name']}")

    print(f"\nDESCRIPTION: {experiment['description']}")

    print("\n" + "=" * 100)

    for query in test_queries:

        print("\n" + "-" * 80)

        print(f"\nQUERY: {query}")

        result = ask(query)

        print("\nGENERATED ANSWER:\n")

        print(result["answer"])

        print("\nRETRIEVED CONTEXTS:\n")

        for idx, source in enumerate(result["sources"]):

            print(f"\nCONTEXT {idx+1}:\n")

            print(source["text"][:300])

            print("\n" + "-" * 40)