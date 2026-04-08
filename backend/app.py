from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from huggingface_hub import InferenceClient
from transformers import pipeline
from dotenv import load_dotenv
import os
import torch

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
    # Initialize the pipeline with a "Hello World" specific model
    generator = pipeline("text-generation", model=MODEL)

    # Ask the model a question or give it a prompt
    output = generator("Say hello world", max_new_tokens=10)
    return {"message": output[0]["generated_text"]}
