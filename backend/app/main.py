"""FastAPI application — entry point with SocketIO mount."""

from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from pathlib import Path

from app.api import auth, projects, tasks, users, notifications, analytics, invitations, activities, documents
from app.cache.redis import close_redis
from app.db.database import engine
from app.db.models import Base
from app.db.seed import seed
from app.socket.handlers import sio

FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent  # => project root


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables + seed demo data
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed()
    yield
    # Shutdown
    await close_redis()
    await engine.dispose()


api_app = FastAPI(
    title="InnoSoft Labs API",
    description="Backend API для системы управления проектами InnoSoft Labs",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────
api_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── API Routers ──────────────────────────────
api_app.include_router(auth.router)
api_app.include_router(projects.router)
api_app.include_router(tasks.router)
api_app.include_router(users.router)
api_app.include_router(notifications.router)
api_app.include_router(analytics.router)
api_app.include_router(invitations.router)
api_app.include_router(activities.router)
api_app.include_router(documents.router)


# ─── Health check ─────────────────────────────
@api_app.get("/api/health", tags=["Health"])
async def health():
    return {"status": "ok"}


class SafeStaticFiles(StaticFiles):
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            await super().__call__(scope, receive, send)
        elif scope["type"] == "websocket":
            await send({"type": "websocket.close"})


# ─── Serve frontend static files ─────────────
api_app.mount("/", SafeStaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

# ─── SocketIO wrapper ────────────────────────
# We wrap the FastAPI app into the SocketIO ASGI app.
# By naming this 'app', both 'uvicorn app.main:app' and 'socket_app' names will work.
app = socketio.ASGIApp(sio, api_app)
socket_app = app

# To run: uvicorn app.main:app --reload --port 8000
# This way both REST API and WebSocket work on the same port
