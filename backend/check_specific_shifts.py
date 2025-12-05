#!/usr/bin/env python3
from sqlmodel import Session, create_engine, select
from models import Employee, Shift
from datetime import datetime

engine = create_engine("sqlite:///schedule.db")

with Session(engine) as session:
    # Check specific employees
    names = ["Jochy", "Stacian", "Paul", "Jim"]
    
    for name in names:
        print(f"\n{'='*60}")
        print(f"EMPLOYEE: {name}")
        print(f"{'='*60}")
        
        employees = session.exec(
            select(Employee).where(Employee.first_name.ilike(f"%{name}%"))
        ).all()
        
        for emp in employees:
            print(f"\n{emp.first_name} {emp.last_name} (ID: {emp.id})")
            
            shifts = session.exec(
                select(Shift)
                .where(Shift.employee_id == emp.id)
                .order_by(Shift.start_time)
            ).all()
            
            print(f"Total Shifts: {len(shifts)}")
            
            if shifts:
                print("\nShifts:")
                for shift in shifts:
                    duration = (shift.end_time - shift.start_time).total_seconds() / 3600
                    print(f"  {shift.start_time.strftime('%a %m/%d %I:%M%p')} - {shift.end_time.strftime('%I:%M%p')} "
                          f"({duration:.1f}h) @ {shift.location or 'N/A'}")
            else:
                print("  No shifts found!")
