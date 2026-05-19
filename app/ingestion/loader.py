from langchain_community.document_loaders import PyPDFLoader
from pathlib import Path


def load_documents(data_path="data/raw"):
    documents = []

    pdf_files = Path(data_path).glob("*.pdf")

    for pdf in pdf_files:
        loader = PyPDFLoader(str(pdf))
        docs = loader.load()

        documents.extend(docs)

    return documents