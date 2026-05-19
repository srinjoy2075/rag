from app.utils.config import embedding_model


def generate_embeddings(texts):

    embeddings = embedding_model.encode(
        texts,
        show_progress_bar=True
    )

    return embeddings