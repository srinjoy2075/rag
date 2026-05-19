from sentence_transformers import SentenceTransformer

EMBEDDING_MODEL_NAME = "BAAI/bge-small-en-v1.5"

COLLECTION_NAME = "rag_collection"

QDRANT_PATH = "data/qdrant_db"

embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)