from sqlmodel import select
from database import engine, Session
from models import Employee

def set_all_ft():
    with Session(engine) as session:
        employees = session.exec(select(Employee)).all()
        count = 0
        for emp in employees:
            emp.is_full_time = True
            # Ensure consistency: FT employees generally don't have the "willing to work vacation" flag set manually
            # as per previous logic (it's hidden/false).
            emp.willing_to_work_vacation_week = False 
            session.add(emp)
            count += 1
        
        session.commit()
        print(f"Updated {count} employees to Full Time.")

if __name__ == "__main__":
    set_all_ft()
