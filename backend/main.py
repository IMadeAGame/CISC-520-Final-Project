import json
import logging
import os
from dotenv import load_dotenv

load_dotenv()
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from huggingface_hub import InferenceClient
from models import ChatResponse
from agent import run_agent

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Data Analysis AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173", "https://stock-data-analysis-ai-front-end.onrender.com/"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = InferenceClient(token=os.environ["HF_TOKEN"])


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
async def chat(
    messages: str = Form(...),
    file: UploadFile | None = File(None),
):
    msgs = json.loads(messages)
    csv_data = None
    if file and file.filename:
        contents = await file.read()
        csv_data = contents.decode("utf-8")

    logger.info("chat request: %d messages, file=%s", len(msgs), file.filename if file else None)
    try:
        result = run_agent(msgs, csv_data, client)
        logger.info("chat response: reply_len=%d, images=%d, tables=%d", len(result.reply), len(result.images), len(result.tables))
        return result
    except Exception as e:
        if "429" in str(e) or "rate" in str(e).lower():
            logger.warning("rate limited by HuggingFace")
            return JSONResponse(status_code=429, content={"detail": "Rate limited. Please wait a moment and try again."})
        logger.exception("agent error: %s", e)
        return JSONResponse(status_code=500, content={"detail": str(e)})
