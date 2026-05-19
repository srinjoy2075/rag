from langchain_text_splitters import RecursiveCharacterTextSplitter


def fixed_chunk_documents(
    documents,
    chunk_size=500,
    chunk_overlap=50
):

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )

    chunks = splitter.split_documents(documents)

    return chunks