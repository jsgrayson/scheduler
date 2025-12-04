from sqlmodel import Session, select
from datetime import datetime, timedelta
from database import engine, create_db_and_tables
from models import Employee, Role, Shift, Availability
import os

def create_seed_data():
    # Delete existing db file to force schema update
    if os.path.exists("schedule.db"):
        os.remove("schedule.db")
        
    create_db_and_tables()
    
    with Session(engine) as session:
        # Roles
        manager = Role(name="Manager", color_hex="#EF4444") # Red
        server = Role(name="Server", color_hex="#3B82F6")  # Blue
        cook = Role(name="Cook", color_hex="#10B981")    # Green
        cashier = Role(name="Cashier", color_hex="#8B5CF6") # Purple
        elot = Role(name="Elot", color_hex="#F97316")    # Orange
        clot = Role(name="CLot", color_hex="#06B6D4")    # Cyan
        
        session.add(manager)
        session.add(server)
        session.add(cook)
        session.add(cashier)
        session.add(elot)
        session.add(clot)
        session.commit()
        
        # Real employees from OCR
        jochy = Employee(first_name="Jochy", last_name="G.", default_role_id=manager.id, max_weekly_hours=40, is_full_time=True)
        stacian = Employee(first_name="Stacian", last_name="Hamilton", default_role_id=cashier.id, max_weekly_hours=40, is_full_time=True)
        brooke = Employee(first_name="Brooke", last_name="M.", default_role_id=manager.id, max_weekly_hours=40, is_full_time=True)
        meghan = Employee(first_name="Meghan", last_name="S.", default_role_id=manager.id, max_weekly_hours=40, is_full_time=True)
        
        session.add(jochy)
        session.add(stacian)
        session.add(brooke)
        session.add(meghan)
        
        session.commit()
        
        print("Seed data created successfully! (Real employees only)")
        print("Seed data created successfully!")

if __name__ == "__main__":
    create_seed_data()
