from app.utils.config import embedding_model


def generate_embeddings(texts, show_progress_bar: bool = False):

    embeddings = embedding_model.encode(
        texts,
        show_progress_bar=show_progress_bar,
    )

    return embeddings