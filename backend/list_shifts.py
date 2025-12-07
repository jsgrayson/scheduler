from sqlmodel import Session, create_engine, select
from models import Shift
from datetime import datetime

engine = create_engine("sqlite:///schedule.db")

def list_shifts():
    with Session(engine) as session:
        shifts = session.exec(select(Shift).limit(5)).all()
        for s in shifts:
            print(f"Shift ID: {s.id}, Start: {s.start_time}, Employee: {s.employee_id}")

if __name__ == "__main__":
    list_shifts()
