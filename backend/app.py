from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from huggingface_hub import InferenceClient
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title="AI Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

HF_TOKEN = os.getenv("HF_TOKEN")
MODEL = "google/flan-t5-small"


@app.get("/agent")
def agent():
    """Ask the LLM to produce a hello-world greeting."""
    client = InferenceClient(model=MODEL, token=HF_TOKEN)
    response = client.text_generation(
        "Say hello world.",
        max_new_tokens=20,
    )
    return {"message": response.strip()}
