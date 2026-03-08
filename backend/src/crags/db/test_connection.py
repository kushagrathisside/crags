from crags.db.session import engine

with engine.connect() as conn:
    print("Database connected successfully")