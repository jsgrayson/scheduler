from sqlmodel import SQLModel, create_engine
from models import RotationState

# Database connection
sqlite_file_name = "backend/scheduler.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"
engine = create_engine(sqlite_url)

def create_table():
    SQLModel.metadata.create_all(engine)
    print("RotationState table created (if it didn't exist).")

if __name__ == "__main__":
    create_table()
