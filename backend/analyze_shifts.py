from sqlmodel import Session, select, func
from database import engine
from models import Shift, Employee
from datetime import timedelta

def analyze_shifts():
    with Session(engine) as db:
        shifts = db.query(Shift).all()
        print(f"Total Shifts: {len(shifts)}")

        # 1. Check for Duplicates (same person, same start)
        duplicates = {}
        for s in shifts:
            key = (s.employee_id, s.start_time)
            if key not in duplicates:
                duplicates[key] = []
            duplicates[key].append(s)
        
        dup_count = 0
        print("\n--- Potential Duplicates ---")
        for key, shift_list in duplicates.items():
            if len(shift_list) > 1:
                dup_count += 1
                emp = db.get(Employee, key[0])
                name = f"{emp.first_name} {emp.last_name}" if emp else "Unknown"
                print(f"{name}: {key[1]} (Count: {len(shift_list)})")
        if dup_count == 0:
            print("No exact duplicates found.")

        # 2. Check for Overlaps
        print("\n--- Overlapping Shifts ---")
        by_employee = {}
        for s in shifts:
            if s.employee_id not in by_employee:
                by_employee[s.employee_id] = []
            by_employee[s.employee_id].append(s)
        
        for emp_id, emp_shifts in by_employee.items():
            emp_shifts.sort(key=lambda x: x.start_time)
            for i in range(len(emp_shifts) - 1):
                s1 = emp_shifts[i]
                s2 = emp_shifts[i+1]
                if s1.end_time > s2.start_time:
                    emp = db.get(Employee, emp_id)
                    name = f"{emp.first_name} {emp.last_name}" if emp else "Unknown"
                    print(f"{name}: {s1.start_time}-{s1.end_time} OVERLAPS {s2.start_time}-{s2.end_time}")

        # 3. Check for Suspicious Durations
        print("\n--- Suspicious Durations (< 2h or > 16h) ---")
        for s in shifts:
            duration = s.end_time - s.start_time
            hours = duration.total_seconds() / 3600
            if hours < 2 or hours > 16:
                emp = db.get(Employee, s.employee_id)
                name = f"{emp.first_name} {emp.last_name}" if emp else "Unknown"
                print(f"{name}: {s.start_time}-{s.end_time} ({hours:.1f} hours) - Loc: {s.location}")

if __name__ == "__main__":
    analyze_shifts()
