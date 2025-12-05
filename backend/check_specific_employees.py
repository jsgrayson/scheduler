from sqlmodel import Session, select
from database import engine
from models import Shift, Employee

def check_employees():
    with Session(engine) as db:
        for name in ["Jochy", "Stacian"]:
            # Find employee
            statement = select(Employee).where(
                (Employee.first_name.ilike(f"%{name}%")) | 
                (Employee.last_name.ilike(f"%{name}%"))
            )
            employees = db.exec(statement).all()
            
            if not employees:
                print(f"Employee '{name}' NOT FOUND in database.")
                continue
                
            for emp in employees:
                print(f"Found Employee: {emp.first_name} {emp.last_name} (ID: {emp.id})")
                # Check shifts
                shifts = db.exec(select(Shift).where(Shift.employee_id == emp.id)).all()
                print(f"  - Shift Count: {len(shifts)}")
                for s in shifts:
                    print(f"    - {s.start_time} to {s.end_time} ({s.location})")

if __name__ == "__main__":
    check_employees()
