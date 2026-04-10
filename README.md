# Data Analysis AI

**Live app:** https://stock-data-analysis-ai-front-end.onrender.com

A full-stack AI-powered data analysis assistant. Upload a CSV or ask questions about financial data — the AI writes and executes Python code on the fly, returning Bloomberg-style charts and insights directly in the chat.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vite, React 19 |
| Backend | FastAPI, Uvicorn (deployed on Render) |
| LLM | Anthropic Claude (`claude-opus-4-5`) |
| Code Execution | Python subprocess (sandboxed temp directory, 30s timeout) |
| Data Libraries | pandas, numpy, matplotlib, seaborn, yfinance, scipy |
| Package Management | pip (backend), npm (frontend) |

---

## Architecture

```
Browser (Vite + React)
      |
      | POST /chat  (multipart/form-data: messages + optional CSV file)
      | proxied via Vite dev server → deployed backend on Render
      v
FastAPI  (main.py)
      |
      v
run_agent()  (agent.py)
      |
      |-- Builds message history with system prompt
      |-- Calls Anthropic API  -->  claude-opus-4-5
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
Self-correction: if stderr is non-empty, coaching message is added and Claude retries (up to 2x)
      |
      v
ChatResponse  { reply, code_blocks, images, tables }
      |
      v
Browser renders reply + Bloomberg-style chart + tables
```

### Key design decisions

- **Agentic loop**: the model can call `run_python_code` multiple times (up to 8 iterations). If the code produces an error, it self-corrects and retries up to 2 times before giving up.
- **Single data fetch rule**: the system prompt instructs the model to fetch all external data (e.g. yfinance) in one tool call and perform all analysis in the same block.
- **No isolation beyond temp dir**: code runs as a real subprocess on the host machine inside a `tempfile.TemporaryDirectory()`. There is no container or VM boundary.
- **CORS**: the Vite dev server proxies `/api/*` to the deployed backend, avoiding cross-origin issues in development.

---

## Project Structure

```
data_eng/
├── backend/
│   ├── main.py            # FastAPI app, routes, Anthropic client init
│   ├── agent.py           # Agentic loop, tool dispatch, self-correction
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
    │       ├── ChatInterface.tsx   # Main chat UI, API calls, state
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
- An [Anthropic API key](https://console.anthropic.com/)

### Backend

```bash
cd backend
pip install -r requirements.txt
```

Copy the example env file and add your key:

```bash
cp .env.example .env
```

Edit `.env`:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
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

> The Vite dev server proxies `/api/*` to the backend. By default this points to the deployed Render backend. To use a local backend instead, update the `proxy.target` in `vite.config.ts`.

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
| `ANTHROPIC_API_KEY` | Anthropic API key (required) |
