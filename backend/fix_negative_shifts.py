from sqlmodel import Session, create_engine, select
from models import Shift
from datetime import timedelta

engine = create_engine("sqlite:///schedule.db")
session = Session(engine)

shifts = session.exec(select(Shift)).all()
fixed_count = 0

print("Checking for negative duration shifts...")
for s in shifts:
    if s.start_time and s.end_time:
        if s.end_time < s.start_time:
            print(f"Shift {s.id} (Emp {s.employee_id}): {s.start_time} - {s.end_time} IS NEGATIVE")
            # Assume it's an overnight shift ending the next day
            new_end = s.end_time + timedelta(days=1)
            print(f"  Fixing to: {new_end}")
            s.end_time = new_end
            session.add(s)
            fixed_count += 1

if fixed_count > 0:
    session.commit()
    print(f"Fixed {fixed_count} shifts.")
else:
    print("No negative shifts found.")
