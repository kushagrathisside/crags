from fastapi import FastAPI
from crags.api.router import router

app = FastAPI(
    title="CRAGS API",
    version="0.1.0"
)

@app.get("/")
def root():
    return {"system": "CRAGS running"}

app.include_router(router)