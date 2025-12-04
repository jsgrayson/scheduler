from sqlmodel import Session, select
from database import engine
from models import Shift
from sqlalchemy import text

def clear_shifts():
    with Session(engine) as db:
        try:
            num_deleted = db.query(Shift).delete()
            db.commit()
            print(f"Successfully deleted {num_deleted} shifts.")
            
            # Reset auto-increment if needed (optional, for SQLite)
            # db.execute(text("DELETE FROM sqlite_sequence WHERE name='shift'"))
            # db.commit()
            
        except Exception as e:
            print(f"Error deleting shifts: {e}")
            db.rollback()


if __name__ == "__main__":
    clear_shifts()
