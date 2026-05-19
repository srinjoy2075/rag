from app.ingestion.fixed_chunker import fixed_chunk_documents
from app.ingestion.semantic_chunker import semantic_chunk_documents


def chunk_documents(
    documents,
    strategy="fixed",
    chunk_size=500,
    chunk_overlap=50
):

    if strategy == "fixed":

        return fixed_chunk_documents(
            documents,
            chunk_size,
            chunk_overlap
        )

    elif strategy == "semantic":

        return semantic_chunk_documents(documents)

    else:
        raise ValueError("Invalid chunking strategy")