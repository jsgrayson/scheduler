from sqlmodel import select
from database import engine, Session
from models import Employee

def find_scott():
    with Session(engine) as session:
        employees = session.exec(select(Employee).where(Employee.first_name.like("Scott%"))).all()
        print(f"Found {len(employees)} employees named Scott:")
        for emp in employees:
            print(f"ID: {emp.id}, Name: '{emp.first_name} {emp.last_name}', Role: {emp.default_role_id}")

if __name__ == "__main__":
    find_scott()
