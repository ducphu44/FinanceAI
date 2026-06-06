"""
main.py
-------
FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers import auth, users, files, dashboard, alerts, ai, reports

# ── App factory ───────────────────────────────────────────────────────────────
app = FastAPI(
    title       = "FinanceAI API",
    description = (
        "Backend API cho Hệ thống Quản lý Tài chính Đại học.\n\n"
        "## Authentication\n"
        "Dùng `POST /auth/login` để lấy JWT token, sau đó thêm vào header:\n"
        "`Authorization: Bearer <token>`\n\n"
        "## Demo accounts\n"
        "| Email | Password | Role |\n"
        "|-------|----------|------|\n"
        "| admin@example.com | password123 | admin |\n"
        "| staff@example.com | password123 | finance_staff |\n"
        "| manager@example.com | password123 | finance_manager |\n"
        "| leader@example.com | password123 | leader |"
    ),
    version     = "1.0.0",
    docs_url    = "/docs",
    redoc_url   = "/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(files.router)
app.include_router(dashboard.router)
app.include_router(alerts.router)
app.include_router(ai.router)
app.include_router(reports.router)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"], summary="Health check")
def root():
    return {"status": "ok", "service": "FinanceAI API", "version": "1.0.0"}


@app.get("/health", tags=["Health"], summary="Detailed health check")
def health():
    from app.database import engine
    try:
        with engine.connect() as conn:
            conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {e}"
    return {"status": "ok", "database": db_status}
