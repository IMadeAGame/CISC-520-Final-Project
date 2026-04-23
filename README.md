# Data Analysis AI

**Live app:** https://stock-data-analysis-ai-front-end.onrender.com

A full-stack AI-powered data analysis assistant. Upload a CSV or ask questions about financial data — the AI writes and executes Python code on the fly, returning Bloomberg-style charts and insights directly in the chat.

A longer technical write-up (architecture, LLM, agents, evaluation) lives in [REPORT.md](./REPORT.md).

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vite, React 19 |
| Backend | FastAPI, Uvicorn (deployed on Render) |
| LLM | [Hugging Face Inference API](https://huggingface.co/docs/huggingface_hub/guides/inference) — **`Qwen/Qwen2.5-72B-Instruct`** (`huggingface_hub.InferenceClient`) |
| Code Execution | Python subprocess (temp directory per run, **90s** timeout) |
| Data Libraries | pandas, numpy, matplotlib, seaborn, yfinance, scipy |
| Package Management | pip (backend), npm (frontend) |

---

## Architecture

```
Browser (Vite + React)
      |
      | POST /chat or POST /chat/stream  (multipart/form-data: messages + optional CSV file)
      | Frontend default: direct POST to deployed backend /chat/stream (see ChatInterface.tsx)
      | Local dev: Vite can proxy /api/* → backend (vite.config.ts)
      v
FastAPI  (main.py)
      |
      v
run_agent() / run_agent_stream()  (agent.py)
      |
      |-- Builds message history with system prompt
      |-- Calls Hugging Face Inference API  -->  Qwen/Qwen2.5-72B-Instruct
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
      |-- Runs: subprocess.run(["python3", script.py], timeout=90s)
      |-- Captures stdout, stderr
      |-- Reads plot.png if saved, base64-encodes it
      |
      v
Tool result  { stdout, stderr, image_b64 }
      |
      v
Agent appends result to message history, calls model again for final reply
Self-correction: if stderr indicates a real error, coaching message is added and the model retries (up to 2x)
      |
      v
ChatResponse / SSE done  { reply, code_blocks, images, tables }
      |
      v
Browser renders reply + Bloomberg-style chart + tables
```

### Key design decisions

- **Agentic loop**: the model can call `run_python_code` multiple times (up to 8 iterations). If the code produces a real error (non-warning stderr), it self-corrects and retries up to 2 times before giving up.
- **Single data fetch rule**: the system prompt instructs the model to fetch all external data (e.g. yfinance) in one tool call and perform all analysis in the same block.
- **No isolation beyond temp dir**: code runs as a real subprocess on the host machine inside a `tempfile.TemporaryDirectory()`. There is no container or VM boundary.
- **CORS**: explicit origins in FastAPI include localhost and the Render frontend URL. The Vite dev server can proxy `/api/*` to a backend for local development.

---

## Project Structure

```
.
├── REPORT.md              # Technical report (architecture, LLM, evaluation)
├── backend/
│   ├── main.py            # FastAPI app, routes, Hugging Face InferenceClient
│   ├── agent.py           # Agentic loop, tool dispatch, self-correction, streaming
│   ├── tools.py           # Tool schema and execution dispatch
│   ├── code_runner.py     # Subprocess execution, Bloomberg theme preamble
│   ├── system_prompt.py   # LLM system prompt
│   ├── models.py          # Pydantic request/response models
│   ├── requirements.txt   # Python dependencies
│   └── .env.example       # Environment variable template
└── frontend/
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── index.css
    │   └── components/
    │       ├── ChatInterface.tsx   # Main chat UI, SSE stream, state
    │       ├── MessageBubble.tsx   # Renders text + code + charts + tables
    │       ├── CodeBlock.tsx       # Syntax-highlighted Python
    │       ├── ChartImage.tsx      # Renders base64 PNG charts
    │       ├── DataTable.tsx       # Renders JSON rows as a table
    │       ├── FileUpload.tsx      # CSV file attachment
    │       └── ExamplePrompts.tsx  # Starter prompt cards
    ├── index.html
    ├── vite.config.ts
    └── package.json
```

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- A [Hugging Face](https://huggingface.co/) account and **Inference API** access token with permission to call the chosen model

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

> **API URL:** `ChatInterface.tsx` defaults to the deployed Render backend `.../chat/stream`. To hit a local backend, set `API_URL` in that file (or point the Vite `proxy.target` at `http://127.0.0.1:8000` and use a relative `/chat/stream` path if you adjust the client accordingly).

> The Vite dev server can proxy `/api/*` to a backend. By default `vite.config.ts` targets the deployed Render backend. To use a local backend instead, update the `proxy.target` in `vite.config.ts`.

---

## Usage

1. Open `http://localhost:3000`
2. Click an example prompt or type your own — e.g. *"Plot AAPL stock price for the last 100 days"*
3. Optionally upload a CSV file for custom dataset analysis
4. The AI writes Python, executes it, and returns a Bloomberg-style chart with a written interpretation

### Example prompts

- *"Fetch the last 100 days of AAPL closing prices, plot a line chart, and compute mean, median, std, min, max"*
- *"Analyze the uploaded CSV: show first 5 rows, column types, missing values, and a histogram"*
- *"Compare TSLA and MSFT monthly returns over the past year, plot them, and run a t-test"*

---

## Environment Variables

| Variable | Description |
|---|---|
| `HF_TOKEN` | Hugging Face API token (required for `InferenceClient` in `main.py`) |
