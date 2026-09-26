import truststore

# Use the operating system's trusted certificates for HTTPS (e.g. to OpenAI). On machines where
# antivirus or a company proxy inspects HTTPS (Avast, etc.), Python's own list would reject them.
truststore.inject_into_ssl()

from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api import agent, ai, budget, insights, kpis, operations, priorities, recurring, register, sla, trends

# The OpenAI key lives in backend/.env, next to the NestJS settings; a repo-root .env also works.
load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

app = FastAPI(title="Bashkia 360 API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    kpis.router,
    trends.router,
    sla.router,
    recurring.router,
    operations.router,
    budget.router,
    priorities.router,
    insights.router,
    agent.router,
    register.router,
    ai.router,
):
    app.include_router(router, prefix="/api")


@app.get("/health", tags=["Health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
