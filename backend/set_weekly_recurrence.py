from sqlmodel import Session, create_engine, select
from models import Shift
from datetime import datetime, timedelta

# Connect to database
engine = create_engine("sqlite:///schedule.db")

with Session(engine) as session:
    # Get all shifts
    shifts = session.exec(select(Shift)).all()
    
    print(f"Found {len(shifts)} shifts to update")
    
    # Group shifts by employee+role+time pattern to identify unique shift patterns
    # Each unique pattern becomes a parent shift
    shift_patterns = {}
    
    for shift in shifts:
        # Create a pattern key based on day of week, time, employee, role, location
        day_of_week = shift.start_time.weekday()
        start_time = shift.start_time.time()
        end_time = shift.end_time.time()
        pattern_key = (
            shift.employee_id,
            shift.role_id,
            shift.location,
            day_of_week,
            start_time.hour,
            start_time.minute,
            end_time.hour,
            end_time.minute
        )
        
        if pattern_key not in shift_patterns:
            shift_patterns[pattern_key] = []
        shift_patterns[pattern_key].append(shift)
    
    print(f"Identified {len(shift_patterns)} unique shift patterns")
    
    # For each pattern, make the first occurrence the parent
    updated_count = 0
    for pattern_key, pattern_shifts in shift_patterns.items():
        # Sort by date to find the earliest one
        pattern_shifts.sort(key=lambda s: s.start_time)
        parent_shift = pattern_shifts[0]
        
        # Make sure parent has no parent_id
        if parent_shift.parent_id is not None:
            parent_shift.parent_id = None
            updated_count += 1
        
        # Set all other shifts in this pattern to reference the parent
        for child_shift in pattern_shifts[1:]:
            if child_shift.parent_id != parent_shift.id:
                child_shift.parent_id = parent_shift.id
                updated_count += 1
    
    # Commit changes
    session.commit()
    
    print(f"✅ Updated {updated_count} shifts to have weekly recurrence")
    print(f"   {len(shift_patterns)} unique weekly shift patterns")
