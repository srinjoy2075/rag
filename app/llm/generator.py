import os

import google.generativeai as genai

from dotenv import load_dotenv


load_dotenv()

genai.configure(
    api_key=os.getenv("GEMINI_API_KEY")
)

model = genai.GenerativeModel(
    "gemini-2.5-flash"
)


def generate_answer(query, retrieved_docs):

    context = "\n\n".join([
        doc["text"] for doc in retrieved_docs
    ])

    prompt = f"""
You are an expert assistant.

Use ONLY the provided context.

If the answer is not in the context, say:
"I could not find the answer in the provided documents."

Context:
{context}

Question:
{query}
"""

    response = model.generate_content(prompt)

    return response.text