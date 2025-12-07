from sqlmodel import Session, create_engine, select
from models import Shift

engine = create_engine("sqlite:///schedule.db")
session = Session(engine)

shifts = session.exec(select(Shift)).all()
print(f"Found {len(shifts)} shifts.")

for s in shifts:
    s.is_repeating = True
    session.add(s)

session.commit()
print("All shifts marked as repeating.")
