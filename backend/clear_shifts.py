from sqlmodel import Session, select, delete
from database import engine
from models import Shift

def clear_all_shifts():
    """Delete all shifts from the database."""
    with Session(engine) as session:
        # Count before deletion
        count_before = len(session.exec(select(Shift)).all())
        print(f"Shifts before deletion: {count_before}")
        
        # Delete all shifts
        statement = delete(Shift)
        session.exec(statement)
        session.commit()
        
        # Count after deletion
        count_after = len(session.exec(select(Shift)).all())
        print(f"Shifts after deletion: {count_after}")
        print("✅ All shifts cleared!")

if __name__ == "__main__":
    clear_all_shifts()
