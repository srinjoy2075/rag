from fastapi import FastAPI

from app.rag_pipeline import ask


app = FastAPI()


@app.get("/")
def home():

    return {
        "message": "Advanced RAG Running"
    }


@app.get("/query")
def query_rag(query: str):

    result = ask(query)

    return result