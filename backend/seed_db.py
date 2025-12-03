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
        
        # Employees
        # Alice (Manager) - FT
        alice = Employee(first_name="Alice", last_name="Smith", default_role_id=manager.id, max_weekly_hours=40, is_full_time=True, last_call_time=datetime.now() - timedelta(days=2))
        
        # Bob (Server) - PT
        bob = Employee(first_name="Bob", last_name="Jones", default_role_id=server.id, max_weekly_hours=30, is_full_time=False)
        
        # Charlie (Cook) - FT
        charlie = Employee(first_name="Charlie", last_name="Brown", default_role_id=cook.id, max_weekly_hours=40, is_full_time=True, last_call_time=datetime.now() - timedelta(days=5))
        
        # David (Server) - PT
        david = Employee(first_name="David", last_name="Wilson", default_role_id=server.id, max_weekly_hours=20, is_full_time=False)
        
        # Eve (Server) - FT (New hire, never called)
        eve = Employee(first_name="Eve", last_name="Davis", default_role_id=server.id, max_weekly_hours=40, is_full_time=True, last_call_time=None)
        
        session.add(alice)
        session.add(bob)
        session.add(charlie)
        session.add(david)
        session.add(eve)
        session.commit()
        
        # Availability (Sample)
        # Alice (Manager) - Unavailable Sunday
        session.add(Availability(employee_id=alice.id, day_of_week=6, start_time="00:00", end_time="23:59", is_available=False))
        
        # Bob (Server) - Only available Mon-Fri evenings
        for day in range(5): # 0-4 Mon-Fri
             session.add(Availability(employee_id=bob.id, day_of_week=day, start_time="17:00", end_time="23:00", is_available=True))
             
        session.commit()
        
        # Shifts (Current Week)
        today = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)
        start_of_week = today - timedelta(days=today.weekday()) # Monday
        
        shifts = [
            # Monday
            Shift(employee_id=alice.id, role_id=manager.id, start_time=start_of_week, end_time=start_of_week + timedelta(hours=8)),
            Shift(employee_id=bob.id, role_id=server.id, start_time=start_of_week + timedelta(hours=10), end_time=start_of_week + timedelta(hours=18)),
            
            # Tuesday
            Shift(employee_id=alice.id, role_id=manager.id, start_time=start_of_week + timedelta(days=1), end_time=start_of_week + timedelta(days=1, hours=8)),
            Shift(employee_id=charlie.id, role_id=cook.id, start_time=start_of_week + timedelta(days=1, hours=10), end_time=start_of_week + timedelta(days=1, hours=18)),
            
            # Wednesday (Open Shift example)
            Shift(employee_id=None, role_id=server.id, start_time=start_of_week + timedelta(days=2, hours=11), end_time=start_of_week + timedelta(days=2, hours=19), notes="Open Shift - Needs Server"),
            Shift(employee_id=david.id, role_id=server.id, start_time=start_of_week + timedelta(days=2, hours=17), end_time=start_of_week + timedelta(days=2, hours=22)),
            
            # Thursday
            Shift(employee_id=eve.id, role_id=server.id, start_time=start_of_week + timedelta(days=3, hours=9), end_time=start_of_week + timedelta(days=3, hours=17)),
            
            # Friday
            Shift(employee_id=alice.id, role_id=manager.id, start_time=start_of_week + timedelta(days=4, hours=9), end_time=start_of_week + timedelta(days=4, hours=17)),
            Shift(employee_id=charlie.id, role_id=cook.id, start_time=start_of_week + timedelta(days=4, hours=16), end_time=start_of_week + timedelta(days=4, hours=23)),
            Shift(employee_id=bob.id, role_id=server.id, start_time=start_of_week + timedelta(days=4, hours=17), end_time=start_of_week + timedelta(days=4, hours=23)),
        ]
        
        for shift in shifts:
            session.add(shift)
        
        session.commit()
        print("Seed data created successfully!")

if __name__ == "__main__":
    create_seed_data()
