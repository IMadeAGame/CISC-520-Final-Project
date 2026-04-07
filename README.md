# CISC-520-Final-Project

AI Agent "Hello World" — React frontend + Python (FastAPI) backend powered by a Hugging Face LLM.

## Project Structure

```
├── backend/          # FastAPI server with Hugging Face integration
│   ├── app.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/         # Vite + React UI
    └── src/
        ├── App.jsx
        └── App.css
```

## Setup & Run

### Backend

```bash
cd backend

# 1. Create a virtual environment (optional but recommended)
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set your Hugging Face API token
cp .env.example .env
# Edit .env and replace "your_token_here" with your token from
# https://huggingface.co/settings/tokens

# 4. Start the server
uvicorn app:app --reload
# Server runs at http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# UI available at http://localhost:5173
```

Open **http://localhost:5173**, click **Ask Agent**, and the LLM response will be displayed.

## How It Works

1. The React frontend calls `GET /agent` on the FastAPI backend.
2. The backend sends the prompt `"Say hello world."` to the `google/flan-t5-small` model via the Hugging Face Inference API.
3. The model's response is returned as JSON and rendered in the browser.
