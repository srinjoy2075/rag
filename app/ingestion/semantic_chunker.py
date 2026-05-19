from langchain_experimental.text_splitter import SemanticChunker
from langchain_community.embeddings import HuggingFaceEmbeddings


def semantic_chunk_documents(documents):

    embeddings = HuggingFaceEmbeddings(
        model_name="BAAI/bge-small-en-v1.5"
    )

    splitter = SemanticChunker(
        embeddings
    )

    chunks = splitter.split_documents(documents)

    return chunks