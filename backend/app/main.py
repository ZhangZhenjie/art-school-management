from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import auth, exports, revenue, schedules, sessions, students
from .scheduler import start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    sched = start_scheduler()
    try:
        yield
    finally:
        sched.shutdown(wait=False)


app = FastAPI(title="Art School Management API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://test.javine.ai",
        "https://test.javine.ai",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(students.router, prefix="/api/students", tags=["students"])
app.include_router(sessions.router, prefix="/api", tags=["sessions"])
app.include_router(schedules.router, prefix="/api/schedules", tags=["schedules"])
app.include_router(revenue.router, prefix="/api/revenue", tags=["revenue"])
app.include_router(exports.router, prefix="/api/export", tags=["export"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
