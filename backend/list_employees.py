from sqlmodel import Session, create_engine, select
from models import Employee

# Adjust the database path (running from backend dir)
engine = create_engine("sqlite:///schedule.db")

def list_employees():
    with Session(engine) as session:
        employees = session.exec(select(Employee)).all()
        print(f"Total Employees: {len(employees)}")
        print("-" * 60)
        print(f"{'ID':<5} | {'First Name':<15} | {'Last Name':<15} | {'Role':<5} | {'Phone'}")
        print("-" * 60)
        
        # Sort by First Name for easier duplicate spotting
        employees.sort(key=lambda x: x.first_name)
        
        seen_names = {}
        duplicates = []
        
        for emp in employees:
            print(f"{emp.id:<5} | {emp.first_name:<15} | {emp.last_name:<15} | {emp.default_role_id:<5} | {emp.phone}")
            
            fullname = f"{emp.first_name} {emp.last_name}".lower().strip()
            if fullname in seen_names:
                duplicates.append((seen_names[fullname], emp))
            else:
                seen_names[fullname] = emp
                
        if duplicates:
            print("\n!!! POTENTIAL DUPLICATES DETECTED !!!")
            for original, dup in duplicates:
                print(f"Original: {original.first_name} {original.last_name} (ID: {original.id})")
                print(f"Duplicate: {dup.first_name} {dup.last_name} (ID: {dup.id})")
                print("-" * 30)
        else:
            print("\nNo exact full name duplicates found.")

if __name__ == "__main__":
    list_employees()
