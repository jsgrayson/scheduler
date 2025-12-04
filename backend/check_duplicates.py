from sqlmodel import select
from database import engine, Session
from models import Employee

def check_duplicates():
    with Session(engine) as session:
        employees = session.exec(select(Employee)).all()
        
        print(f"Total employees: {len(employees)}")
        
        # Print all employees sorted by name to find the "Scott G" issue
        print("\n--- All Employees ---")
        employees.sort(key=lambda x: x.first_name)
        for emp in employees:
            print(f"ID: {emp.id}, Name: '{emp.first_name} {emp.last_name}', Role: {emp.default_role_id}, FT: {emp.is_full_time}")
            
        # Group by normalized name
        by_name = {}
        for emp in employees:
            # Normalize: "Jeremy G. (Sup/A)" -> "jeremy g"
            f_name = emp.first_name.lower().split('(')[0].replace('.', '').strip()
            l_name = emp.last_name.lower().split('(')[0].replace('.', '').strip()
            
            name_key = (f_name, l_name)
            if name_key not in by_name:
                by_name[name_key] = []
            by_name[name_key].append(emp)
            
        print("\n--- Potential Duplicates (Normalized) ---")
        found = False
        for name_key, duplicates in by_name.items():
            if len(duplicates) > 1:
                found = True
                print(f"Name: {name_key}")
                for emp in duplicates:
                    print(f"  - ID: {emp.id}, Name: '{emp.first_name} {emp.last_name}'")
        
        if not found:
            print("No duplicates found with current normalization.")

if __name__ == "__main__":
    check_duplicates()
