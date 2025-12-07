from sqlmodel import Session, create_engine, select
from models import Shift
from datetime import timedelta, datetime

engine = create_engine("sqlite:///schedule.db")
session = Session(engine)

# Define current week (or base week)
base_start = datetime(2025, 12, 6)
base_end = datetime(2025, 12, 13)

# Find recurring shifts in base week
base_shifts = session.exec(select(Shift).where(
    Shift.start_time >= base_start,
    Shift.start_time < base_end,
    Shift.is_repeating == True
)).all()

print(f"Found {len(base_shifts)} repeating shifts in base week.")

added_count = 0

for i in range(1, 5): # Project 4 weeks
    week_offset = timedelta(weeks=i)
    print(f"Projecting Week +{i}...")
    
    for s in base_shifts:
        new_start = s.start_time + week_offset
        new_end = s.end_time + week_offset
        
        # Check if exists
        existing = session.exec(select(Shift).where(
            Shift.employee_id == s.employee_id,
            Shift.start_time == new_start,
            Shift.end_time == new_end
        )).first()
        
        if not existing:
            new_shift = Shift(
                employee_id=s.employee_id,
                role_id=s.role_id,
                start_time=new_start,
                end_time=new_end,
                location=s.location,
                booth_number=s.booth_number,
                is_repeating=True,
                is_vacation=s.is_vacation,
                notes=s.notes
            )
            session.add(new_shift)
            added_count += 1

session.commit()
print(f"Successfully generated {added_count} new shifts for the next 4 weeks.")
