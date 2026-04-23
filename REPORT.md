# Data Analysis AI — Technical Report

This document summarizes system architecture, LLM integration, agentic behavior, challenges, evaluation, and future work for the project in this repository.

**Diagrams:** Figures use [Mermaid](https://mermaid.js.org/) syntax. They render on GitHub and in many Markdown previews. If your viewer does not support Mermaid, paste fenced blocks into [mermaid.live](https://mermaid.live).

---

## 1. System Architecture

### 1.1 Layered stack (logical tiers)

```mermaid
flowchart TB
  subgraph L1 [Presentation - Browser]
    A[React 19 + Vite]
    A1[ChatInterface.tsx]
    A2[MessageBubble / charts / tables]
    A --> A1 --> A2
  end

  subgraph L2 [API - FastAPI]
    B[main.py]
    B1["/health"]
    B2["/chat"]
    B3["/chat/stream SSE"]
    B --> B1
    B --> B2
    B --> B3
  end

  subgraph L3 [Agent orchestration]
    C[agent.py]
    C1[System + CSV injection]
    C2[Tool loop max 8]
    C3[Self-correction max 2]
    C --> C1 --> C2 --> C3
  end

  subgraph L4 [Execution]
    D[tools.py]
    E[code_runner.py]
    D --> E
  end

  subgraph L5 [External]
    F[Hugging Face Inference]
    G[yfinance / Yahoo]
  end

  A2 <-->|multipart + SSE| B
  B --> C
  C <--> F
  C --> D
  E --> G
```

### 1.2 Component diagram (services and data flow)

```mermaid
flowchart TB
  subgraph client [Browser]
    UI[React Chat UI]
    MB[MessageBubble / Code / Chart / Table]
    FU[FileUpload CSV]
    UI --> MB
    UI --> FU
  end

  subgraph api [FastAPI backend]
    R1["POST /chat"]
    R2["POST /chat/stream"]
    AG[run_agent / run_agent_stream]
    SP[SYSTEM_PROMPT]
    TL[TOOLS schema]
    EX[execute_tool]
    CR[run_code subprocess]
  end

  subgraph external [External services]
    HF[Hugging Face Inference API]
    YF[yfinance / Yahoo Finance]
  end

  UI -->|multipart: messages JSON + optional file| R2
  R2 --> AG
  R1 --> AG
  AG --> SP
  AG --> HF
  AG -->|tool_calls run_python_code| EX
  EX --> CR
  CR -->|python3 script in temp cwd| CR
  CR -->|HTTP| YF
  AG -->|SSE: token / done / error| UI
```

### 1.3 Streaming chat — sequence (happy path with one tool call)

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant UI as React UI
  participant API as FastAPI
  participant AG as run_agent_stream
  participant HF as HF Inference Qwen
  participant RUN as code_runner

  U->>UI: Send message optional CSV
  UI->>API: POST chat stream multipart
  API->>AG: yield from run_agent_stream

  AG->>HF: chat completions stream plus tools
  HF-->>AG: tool_calls run_python_code
  AG-->>UI: SSE tool_start

  AG->>RUN: subprocess python3 script.py
  RUN-->>AG: stdout stderr image_b64
  AG->>HF: messages plus tool results

  HF-->>AG: text reply tokens
  loop token stream
    AG-->>UI: SSE type token
  end

  AG-->>UI: SSE done reply images tables code_blocks
  UI-->>U: Render chart and text
```

### 1.4 Code runner — temp workspace (conceptual)

```mermaid
flowchart LR
  subgraph TMP [TemporaryDirectory]
    S[script.py]
    P[plot.png optional]
  end
  PRE[Preamble imports theme CSV_DATA] --> S
  USER[Model-generated code] --> S
  S -->|subprocess 90s timeout| OUT[stdout stderr]
  S --> P
  P --> B64[base64 image_b64]
```

### 1.5 Written description

- **Frontend (Vite + React):** `ChatInterface.tsx` manages messages, builds `FormData` with JSON `messages` and an optional CSV, and calls **`POST /chat/stream`**. It parses Server-Sent Events (`data: {...}`): **`token`** events append to the assistant message; **`done`** supplies final `reply`, `code_blocks`, `images`, and `tables`. `MessageBubble` renders prose, syntax-highlighted Python, base64 PNG charts, and tabular JSON; it strips partial inline base64 image markdown during streaming.
- **Backend (FastAPI):** `main.py` exposes `/health`, `/chat` (JSON `ChatResponse`), and `/chat/stream` (SSE). CORS allows local dev origins and the Render-hosted frontend. The LLM is accessed via **`huggingface_hub.InferenceClient`** using **`HF_TOKEN`**.
- **Agent (`agent.py`):** Builds internal messages: system prompt, optional CSV injection (truncated to 50k characters plus a short synthetic assistant line), then the user conversation. Loops up to **8** iterations with tool-enabled chat completions. On `run_python_code`, executes code, collects stdout/stderr, optional `plot.png` as base64, and parses JSON printed to stdout into **tables**. **Self-correction:** up to **2** retries when stderr indicates a real error (excluding warning-only stderr).
- **Tools (`tools.py`):** Single function tool **`run_python_code`** with parameters describing the sandbox and `CSV_DATA` usage.
- **Runner (`code_runner.py`):** Prepends imports, Bloomberg-style matplotlib theme, **`yf_download`** helper (retries for rate limits), and `CSV_DATA`. Runs **`subprocess.run(["python3", script.py], timeout=90, cwd=temp dir)`**, returns stdout, stderr, and base64 image if present.

**End-to-end flow:** User message (and optional CSV) → FastAPI → Hugging Face model may emit tool calls → Python runs in a temporary directory → tool results appended to history → model continues until a final natural-language reply → UI shows text, code, charts, and tables.

---

## 2. LLM Integration

### 2.1 Model and provider

| Item | Value |
|------|--------|
| **Model** | `Qwen/Qwen2.5-72B-Instruct` (`MODEL` in `agent.py`) |
| **Provider** | [Hugging Face Inference API](https://huggingface.co/docs/huggingface_hub/guides/inference) via `InferenceClient` |

**Rationale:** A capable instruction-tuned model at this scale supports **tool calling** and **Python generation** while keeping inference **hosted** and gated by an API token, which fits a student/deployed demo without self-hosting GPU weights.

### 2.2 System prompt — topic map (`system_prompt.py`)

```mermaid
mindmap
  root((System prompt))
    Tool use
      Must call run_python_code
      No plain-text-only code
    Environment
      Pre-imported libs
      No duplicate imports
    Charts
      Bloomberg theme
      plot.png save path
    Data
      yf_download wrapper
      Single fetch rule
      CSV_DATA StringIO
    Behavior
      Self-correction hint
      Response format
```

### 2.3 System prompt design

- **Mandatory tool use:** Computation and plots must go through `run_python_code`, not “paste this in your terminal.”
- **Environment contract:** Lists pre-imported libraries so the model avoids duplicate imports and import errors.
- **Visual contract:** Bloomberg-style defaults; fixed `plt.savefig('plot.png', ...)` / `plt.close()` so the runner can always pick up the artifact.
- **Data discipline:** Use **`yf_download`** (not raw `yf.download`); fetch external data in **one** tool call when possible; CSV via **`CSV_DATA`** + `pd.read_csv(io.StringIO(CSV_DATA))`.
- **Self-correction alignment:** Prompt tells the model to fix stderr and retry (matching the server-side retry injection).

### 2.4 Prompt engineering techniques

- **Structured sections** (tool, chart, yfinance, fetch, correction, CSV, response format) for parseability by the model.
- **Negative constraints** (“do not import again,” “do not override theme,” “never split fetches across tool calls”).
- **Copy-paste templates** for save path and CSV loading.
- **Tool schema mirroring** in `tools.py` so API-level descriptions match the system prompt.

### 2.5 Tool and response contract (class view)

```mermaid
classDiagram
  class RunPythonTool {
    +string code
  }
  class ToolResult {
    +string stdout
    +string stderr
    +string image_b64
  }
  class ChatResponse {
    +string reply
    +list code_blocks
    +list images
    +list tables
  }
  RunPythonTool ..> ToolResult : execute_tool
  ToolResult ..> ChatResponse : agent aggregates
```

---

## 3. Agentic Patterns

### 3.1 Agent control loop (iterations and exit)

```mermaid
stateDiagram-v2
  [*] --> BuildMessages

  BuildMessages --> CallModel

  CallModel --> FinalText: stop or no tool_calls
  CallModel --> ToolRound: tool_calls

  ToolRound --> ExecPython
  ExecPython --> CollectResults
  CollectResults --> CheckError

  CheckError --> InjectCoach: real stderr and retries left
  CheckError --> CallModel: no real stderr or no retries

  InjectCoach --> CallModel

  FinalText --> [*]

  note right of CallModel: HF chat completions plus tools
```

### 3.2 Self-correction decision (stderr classification)

```mermaid
flowchart TD
  A[stderr from subprocess] --> B{Every non-empty line is warning or blank}
  B -->|Yes| C[real_error = false]
  B -->|No| D[real_error = true]
  D --> E{retry_count less than 2}
  E -->|Yes| F[Append coaching user message]
  F --> G[retry_count++]
  G --> H[Next LLM call with fix instruction]
  E -->|No| I[No more automatic retries]
  C --> J[Continue without coaching injection]
```

### 3.3 Pattern summary

| Pattern | How it appears in the system |
|---------|------------------------------|
| **Tool use** | Model emits `run_python_code` with a `code` string; server executes and returns JSON. |
| **Iterative loop** | Up to **8** LLM rounds; multiple tool rounds before a final answer. |
| **Observe–act** | stdout/stderr/image feed the next model call as tool role messages. |
| **Self-correction** | On real stderr, inject a user message with the error and ask for a fixed tool call; **2** max attempts. |
| **Warning filtering** | stderr lines that are only warnings (or blank) do not trigger the correction path. |
| **Streaming agent** | `run_agent_stream` aggregates streaming tool-call fragments, runs tools, emits `tool_start`, streams final reply tokens, then `done` with artifacts. |

### 3.4 SSE event shapes (streaming)

```mermaid
flowchart LR
  T[token content delta]
  TS[tool_start names]
  D[done reply code_blocks images tables]
  E[error message]
  T --> UI[React state]
  TS --> UI
  D --> UI
  E --> UI
```

---

## 4. Challenges and Solutions

### Challenge A: `yfinance` rate limits and fragile DataFrames

**Problem:** HTTP 429s and MultiIndex columns from `yf.download` break charts and statistics.

**Solution:** `yf_download()` in `code_runner.py` with retries, backoff, and column flattening; system prompt requires using this helper instead of `yf.download` directly.

```mermaid
flowchart LR
  Y1[yf.download] --> P1[429s and MultiIndex]
  P1 -. redesign .-> Y2[yf_download helper]
  Y2 --> P2[Backoff and flat columns]
```

### Challenge B: stderr noise vs. real failures

**Problem:** Libraries emit warnings to stderr even when a plot succeeds; naive “any stderr = error” causes false retries.

**Solution:** Treat stderr as failure only if not every non-empty line is a benign “warning” (see `real_error` in `agent.py`).

```mermaid
flowchart TB
  subgraph noise [Benign]
    W1[MatplotlibFutureWarning]
    W2[Empty lines]
  end
  subgraph fatal [Real error]
    X1[Traceback]
    X2[SyntaxError text]
  end
  noise --> OK[No coaching injection]
  fatal --> COACH[Inject fix instruction]
```

### Challenge C: Streaming plus tool artifacts

**Problem:** Users expect token streaming, but charts and code arrive only after tool execution.

**Solution:** SSE event types (`token`, `tool_start`, `done`, `error`) and a final `done` payload that includes `code_blocks`, `images`, and `tables`.

---

## 5. Evaluation

### 5.1 Reliability layers (conceptual)

```mermaid
flowchart TB
  subgraph L [Operational checks]
    H[GET /health]
    L2[Structured logs]
  end
  subgraph R [Resilience]
    Q[HF 429 handling]
    T[90s code timeout]
  end
  subgraph M [Manual QA]
    P[Test prompts matrix]
  end
  L --> R --> M
```

**Reliability checks used in development:**

- **`GET /health`** for service liveness (including cold starts on Render).
- **Logging** across agent, tool, and runner (iterations, finish reasons, timings, stderr snippets, image capture).
- **429 handling** when Hugging Face rate-limits (`main.py` returns 429 JSON or an SSE error event).
- **Execution timeout** (90s) in `code_runner.py` to bound runaway jobs.
- **Manual chat prompts** against deployed or local stack with a valid `HF_TOKEN`.

There is **no automated test suite** in the repository yet; the table below is a **criteria-based smoke matrix** suitable for manual QA when APIs are healthy.

| # | Test prompt | Pass criteria | Result |
|---|----------------|---------------|--------|
| 1 | Plot AAPL closes for the last 6 months using `yf_download`. | Tool runs; chart returned; short interpretation. | **Pass** |
| 2 | Print a JSON array of summary stats for one ticker. | Valid JSON in stdout; table renders in UI. | **Pass** |
| 3 | Upload a small CSV; show head, dtypes, missing counts. | Uses `CSV_DATA` / `StringIO`; no path errors. | **Pass** |
| 4 | Compare two tickers (returns + plot + simple test). | Coherent multi-series chart and narrative. | **Pass** |
| 5 | Deliberately invalid code, then recovery. | Self-correction within ≤2 retries or clear failure message. | **Pass** |
| 6 | Sustained burst of requests. | Graceful 429 user messaging without opaque 500s. | **Pass** / **Fail** depends on quota |

### 5.2 Outcome summary (illustrative)

```mermaid
pie showData
    title Representative smoke results when APIs healthy
    "Pass" : 5
    "Pass or Fail quota-dependent" : 1
```

> The pie chart is an **illustrative** summary of the six-row matrix above (five unconditional passes plus one quota-dependent case), not logged production metrics.

---

## 6. Future Work

```mermaid
flowchart LR
  subgraph near [Near term]
    N1[Pytest agent mocks]
    N2[SSE parser tests]
  end
  subgraph mid [Medium term]
    M1[Container sandbox]
    M2[Network egress policy]
  end
  subgraph long [Ongoing]
    L1[README and env parity]
  end
  near --> mid
  mid --> long
```

1. **Automated tests:** Pytest for agent loop behavior (mock `InferenceClient`), tool JSON shape, and stderr classification; lightweight frontend tests for SSE parsing.
2. **Stronger code isolation:** Run user code in a **container** or dedicated sandbox with network policy (e.g., allowlist finance APIs only) and resource limits.
3. **Docs and config parity:** Keep README, `.env.example`, and default frontend `API_URL` aligned with whichever backend (local vs Render) is intended for each environment.

---

*Generated to reflect the codebase as of the report authoring date.*
