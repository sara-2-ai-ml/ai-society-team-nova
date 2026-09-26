# Team Nova

A dashboard for citizens' requests in the municipality: the **Operatori** registers them
(form or Excel), each **Drejtori / Agjenci** works its own, and the **Kryetari** sees them all.

How it works and a demo script: **[docs/WORKFLOW.md](docs/WORKFLOW.md)**.

```
frontend/          React + Vite + TypeScript + Tailwind website
backend/src/       NestJS API: login, roles, request workflow, Excel import, stats, reports
backend/*.py …     Python service (FastAPI): Bashkia 360 data + OpenAI agent
data/raw/          Bashkia_360_Data.xlsx
notebooks/         Data pipeline notebook
docs/              Workflow explanation
```

How the parts fit:

```
website ──► NestJS (:3000)  login + roles, "each unit sees only its own"
                │
                └─► Python (:8000)  real data from the Excel file + OpenAI agent
```

The website only talks to NestJS. NestJS applies the user's role before calling Python: a
directorate user's question reaches the AI with only that directorate's data. DSHP and DI come
from `Bashkia_360_Data.xlsx`; the other units use sample data until real data exists.

## Run it

Start the three services in this order.

**1. Python service** (http://localhost:8000, from the repo root):

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

**2. Backend** (http://localhost:3000/api):

```bash
cd backend
npm install
cp .env.example .env
npm run start:dev
```

**3. Frontend** (http://localhost:5173; Vite forwards `/api` to the backend):

```bash
cd frontend
npm install
npm run dev
```

### The AI key

Put your OpenAI key in **`backend/.env`** (both NestJS and Python read this file), then restart
the Python service:

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-mini
```

Without a key everything still works: the assistant and the reports answer from rules over the
same data, and the assistant page says so. If Python is not running, NestJS shows sample data and
connects by itself once Python starts (as long as nothing was changed in the meantime).

## Accounts (development)

All seeded accounts use the password in `SEED_PASSWORD` (`backend/.env`). The sign-in page lists them.

| Role | Username |
|---|---|
| Kryetari | `kryetari` |
| Operatori | `operator` |
| Drejtoritë | `drejtoria.sociale`, `drejtoria.publike`, `drejtoria.infrastruktura`, `drejtoria.urbanistika` |
| Agjencitë | `agjencia.parqet`, `agjencia.transporti` |

## API

| Method | Path | Who |
|---|---|---|
| POST | `/api/auth/login` | public |
| GET | `/api/auth/me` | signed in |
| GET | `/api/units` | signed in |
| GET | `/api/requests?from&to&unitId&status&q` | signed in (a unit only gets its own) |
| GET | `/api/requests/stats?from&to&unitId` | signed in (a unit only gets its own) |
| GET | `/api/requests/:id` | signed in |
| POST | `/api/requests` | Operatori |
| POST | `/api/requests/import?dryRun=true` | Operatori (multipart `file`, .xlsx) |
| GET | `/api/requests/template` | public (empty Excel template) |
| GET | `/api/requests/next-number` | Operatori |
| POST | `/api/requests/:id/actions` | unit: `start`/`complete`/`return` · operator: `resend` |
| GET | `/api/assistant/suggestions` · POST `/api/assistant/ask` | signed in |
| GET | `/api/reports?from&to&unitId&refresh` | Drejtoria (own unit), Kryetari. Default: last 7 days |
| GET | `/api/ai/status` | signed in: is the AI on, where the data comes from |

Reports are written by OpenAI (via the Python service) when `OPENAI_API_KEY` is set in `backend/.env`,
otherwise by rules from the same numbers.

DSHP and DI come from `data/raw/Bashkia_360_Data.xlsx` (via Python); the other units are sample data (`backend/src/**/*.mock.ts`). Changes made in the app are kept in memory and reset on restart.

## Tests

```bash
cd backend && npm test && npm run test:e2e
.venv/Scripts/python -m pytest backend/tests
```
