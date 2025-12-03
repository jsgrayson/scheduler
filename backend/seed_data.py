from sqlmodel import Session, select
from database import engine, create_db_and_tables
from models import Role, Employee, Shift
from datetime import datetime, timedelta

def seed_data():
    create_db_and_tables()
    
    with Session(engine) as session:
        # Check if roles exist
        if session.exec(select(Role)).first():
            print("Data already exists.")
            return

        # Create Roles
        roles = [
            Role(name="Cashier", color_hex="#FF5733"),
            Role(name="Elot", color_hex="#33FF57"),
            Role(name="CLot", color_hex="#3357FF"),
            Role(name="Manager", color_hex="#FF33F6"),
        ]
        for r in roles:
            session.add(r)
        session.commit()
        
        # Refresh to get IDs
        for r in roles:
            session.refresh(r)
            
        # Create Employees
        employees = [
            Employee(first_name="John", last_name="Doe", email="john@example.com", is_full_time=True, default_role_id=roles[0].id),
            Employee(first_name="Jane", last_name="Smith", email="jane@example.com", is_full_time=False, default_role_id=roles[0].id, willing_to_work_vacation_week=True),
            Employee(first_name="Bob", last_name="Jones", email="bob@example.com", is_full_time=False, default_role_id=roles[1].id, willing_to_work_vacation_week=False),
            Employee(first_name="Alice", last_name="Brown", email="alice@example.com", is_full_time=True, default_role_id=roles[2].id),
        ]
        for e in employees:
            session.add(e)
        session.commit()
        
        print("Database seeded successfully!")

if __name__ == "__main__":
    seed_data()
