# Healthcare App Monorepo

Production-oriented layout with a **Next.js 14** frontend and a **FastAPI** backend.

## Structure

| Path | Description |
|------|-------------|
| `frontend/` | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| `backend/` | FastAPI API (Python 3.11) |

## Prerequisites

- Node.js 18+ (recommended for Next.js 14)
- Python 3.11

## Frontend

```bash
cd frontend
cp .env.local.example .env.local
# Edit .env.local with the URLs and keys given by me,
npm install
npm run dev
```

The app runs at `http://localhost:3000` by default.

## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
cp .env.example .env
# Edit .env with keys given by me.
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API docs: `http://localhost:8000/docs`

## Deployment

The backend includes a `Procfile` for platforms that honor it (e.g. Heroku-style). Set `PORT` in the environment; the app binds to `0.0.0.0`.