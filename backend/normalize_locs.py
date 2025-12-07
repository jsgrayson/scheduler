from sqlmodel import Session, select
from database import engine
from models import Shift, ShiftTemplate

def normalize():
    with Session(engine) as session:
        # Shifts
        shifts = session.exec(select(Shift)).all()
        for s in shifts:
            if s.location:
                # Handle edge cases, map specific names if needed?
                # For now, simplistic UPPER + TRIM
                s.location = s.location.upper().strip()
                session.add(s)
        
        # Templates
        templates = session.exec(select(ShiftTemplate)).all()
        for t in templates:
            if t.location:
                t.location = t.location.upper().strip()
                session.add(t)
        
        session.commit()
        print("Locations normalized to UPPERCASE.")

if __name__ == "__main__":
    normalize()
