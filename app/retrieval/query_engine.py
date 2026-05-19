from app.retrieval.retriever import retrieve


def ask(query):

    results = retrieve(query)

    context = "\n\n".join([
        r["text"] for r in results
    ])

    return context