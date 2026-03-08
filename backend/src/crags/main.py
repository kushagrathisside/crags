from fastapi import FastAPI
from crags.api.router import router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="CRAGS API",
    version="0.1.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)