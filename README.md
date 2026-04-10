# Data Analysis AI

A full-stack AI-powered data analysis assistant. Upload a CSV or ask questions about financial data — the AI writes and executes Python code on the fly, returning charts and insights directly in the chat.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Backend | FastAPI, Uvicorn |
| LLM | Hugging Face Inference API (`Qwen/Qwen2.5-72B-Instruct`) |
| Code Execution | Python subprocess (sandboxed temp directory) |
| Data Libraries | pandas, numpy, matplotlib, seaborn, yfinance, scipy |
| Package Management | pip (backend), npm (frontend) |

---

## Architecture

```
Browser (Next.js)
      |
      | POST /chat  (multipart/form-data: messages + optional CSV file)
      v
FastAPI  (main.py)
      |
      v
run_agent()  (agent.py)
      |
      |-- Builds message history with system prompt
      |-- Calls HuggingFace InferenceClient  -->  Qwen2.5-72B-Instruct
      |
      |   Model decides to call tool: run_python_code(code="...")
      |
      v
execute_tool()  (tools.py)
      |
      v
run_code()  (code_runner.py)
      |
      |-- Prepends preamble (imports, Bloomberg theme, CSV_DATA variable)
      |-- Writes full script to a temp file
      |-- Runs: subprocess.run(["python3", script.py], timeout=30s)
      |-- Captures stdout, stderr
      |-- Reads plot.png if saved, base64-encodes it
      |
      v
Tool result  { stdout, stderr, image_b64 }
      |
      v
Agent appends result to message history, calls model again for final reply
      |
      v
ChatResponse  { reply, code_blocks, images, tables }
      |
      v
Browser renders markdown reply + Bloomberg-style chart + tables
```

### Key design decisions

- **Agentic loop**: the model can call `run_python_code` multiple times (up to 8 iterations). If the code produces an error, it self-corrects and retries up to 2 times before giving up.
- **Single data fetch rule**: the system prompt instructs the model to fetch all external data (e.g. yfinance) in one tool call and perform all analysis in the same block, avoiding redundant API hits.
- **No isolation beyond temp dir**: code runs as a real subprocess on the host machine inside a `tempfile.TemporaryDirectory()`. There is no container or VM boundary.

---

## HuggingFace Integration

The backend uses [`huggingface_hub.InferenceClient`](https://huggingface.co/docs/huggingface_hub/guides/inference) to call the serverless Inference API.

**Model**: `Qwen/Qwen2.5-72B-Instruct`
- Strong tool-calling capability
- Available on the free HuggingFace Inference API tier
- OpenAI-compatible chat completions interface

The client is initialized in `main.py`:

```python
from huggingface_hub import InferenceClient
client = InferenceClient(token=os.environ["HF_TOKEN"])
```

Tool calls use the OpenAI-compatible format:

```python
client.chat.completions.create(
    model="Qwen/Qwen2.5-72B-Instruct",
    messages=[...],
    tools=[{ "type": "function", "function": { ... } }],
    max_tokens=4096,
)
```

---

## Project Structure

```
data_eng/
├── backend/
│   ├── main.py            # FastAPI app, routes, client init
│   ├── agent.py           # Agentic loop, tool dispatch, self-correction
│   ├── tools.py           # Tool schema (OpenAI format) and execution
│   ├── code_runner.py     # Subprocess execution, Bloomberg theme preamble
│   ├── system_prompt.py   # LLM system prompt
│   ├── models.py          # Pydantic request/response models
│   ├── requirements.txt   # Python dependencies
│   └── .env.example       # Environment variable template
└── frontend/
    ├── app/
    │   ├── page.tsx
    │   ├── layout.tsx
    │   └── components/
    │       ├── ChatInterface.tsx   # Main chat UI, API calls
    │       ├── MessageBubble.tsx
    │       ├── FileUpload.tsx
    │       └── ExamplePrompts.tsx
    ├── next.config.mjs
    └── package.json
```

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- A free [HuggingFace account](https://huggingface.co/join) with an access token

### Backend

```bash
cd backend
pip install -r requirements.txt
```

Copy the example env file and add your token:

```bash
cp .env.example .env
```

Edit `.env`:

```
HF_TOKEN=hf_your_token_here
```

Get your token at: https://huggingface.co/settings/tokens (read access is sufficient)

Start the server:

```bash
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## Usage

1. Open `http://localhost:3000`
2. Type a question — e.g. *"Plot AAPL stock price for the last 6 months"*
3. Optionally upload a CSV file for custom data analysis
4. The AI writes Python, executes it, and returns a Bloomberg-style chart with a written interpretation

---

## Environment Variables

| Variable | Description |
|---|---|
| `HF_TOKEN` | HuggingFace access token (required) |
