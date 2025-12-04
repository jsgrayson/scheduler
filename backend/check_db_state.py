from sqlmodel import Session, select, func
from database import engine
from models import Shift

def check_db():
    with Session(engine) as db:
        # Count total shifts
        count = db.query(Shift).count()
        print(f"Total Shifts: {count}")

        # Check for duplicates
        # Group by employee, start, end and count > 1
        duplicates = db.query(
            Shift.employee_id, Shift.start_time, Shift.end_time, func.count(Shift.id)
        ).group_by(
            Shift.employee_id, Shift.start_time, Shift.end_time
        ).having(func.count(Shift.id) > 1).all()

        if duplicates:
            print(f"Found {len(duplicates)} duplicate sets.")
            for d in duplicates[:5]:
                print(f"Duplicate: Emp {d[0]} at {d[1]} - {d[2]} (Count: {d[3]})")
        else:
            print("No duplicates found.")

if __name__ == "__main__":
    check_db()
