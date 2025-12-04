from sqlmodel import select, col
from database import engine, Session
from models import Employee, EmployeeRole, Shift, Availability

def merge_duplicates():
    with Session(engine) as session:
        # Find all employees
        employees = session.exec(select(Employee)).all()
        
        # Group by name
        # We need a more complex grouping than just a dict key now
        # Let's collect all normalized names first
        normalized_employees = []
        for emp in employees:
            f_name = emp.first_name.lower().split('(')[0].replace('.', '').strip()
            l_name = emp.last_name.lower().split('(')[0].replace('.', '').strip()
            normalized_employees.append({
                "emp": emp,
                "f_name": f_name,
                "l_name": l_name
            })
            
        # Find duplicates
        # We'll use a set of processed IDs to avoid double counting
        processed_ids = set()
        groups = []
        
        for i in range(len(normalized_employees)):
            e1 = normalized_employees[i]
            if e1["emp"].id in processed_ids:
                continue
                
            group = [e1["emp"]]
            processed_ids.add(e1["emp"].id)
            
            for j in range(i + 1, len(normalized_employees)):
                e2 = normalized_employees[j]
                if e2["emp"].id in processed_ids:
                    continue
                
                # Check First Name Match
                if e1["f_name"] == e2["f_name"]:
                    # Check Last Name Match (Exact or Initial)
                    l1 = e1["l_name"]
                    l2 = e2["l_name"]
                    
                    is_match = False
                    if l1 == l2:
                        is_match = True
                    elif len(l1) == 1 and l2.startswith(l1): # "g" matches "ganhao"
                        is_match = True
                    elif len(l2) == 1 and l1.startswith(l2): # "ganhao" matches "g"
                        is_match = True
                        
                    if is_match:
                        group.append(e2["emp"])
                        processed_ids.add(e2["emp"].id)
            
            if len(group) > 1:
                groups.append(group)
                
        merged_count = 0
        
        for duplicates in groups:
            print(f"Found duplicates: {[f'{e.first_name} {e.last_name}' for e in duplicates]}")
            
            # Pick the one with the longer name as primary (usually the full name)
            duplicates.sort(key=lambda x: len(x.last_name), reverse=True)
            primary = duplicates[0]
            others = duplicates[1:]
                
            # 1. Consolidate Roles
            # Ensure primary has its own default role linked
            if primary.default_role_id:
                link = session.exec(select(EmployeeRole).where(
                    EmployeeRole.employee_id == primary.id,
                    EmployeeRole.role_id == primary.default_role_id
                )).first()
                if not link:
                    session.add(EmployeeRole(employee_id=primary.id, role_id=primary.default_role_id))
            
            for other in others:
                # Link other's default role to primary
                if other.default_role_id:
                    # Check if primary already has this role
                    existing = session.exec(select(EmployeeRole).where(
                        EmployeeRole.employee_id == primary.id,
                        EmployeeRole.role_id == other.default_role_id
                    )).first()
                    
                    if not existing:
                        print(f"  - Adding role {other.default_role_id} from duplicate {other.id} to primary {primary.id}")
                        session.add(EmployeeRole(employee_id=primary.id, role_id=other.default_role_id))
                
                # 2. Reassign Shifts
                shifts = session.exec(select(Shift).where(Shift.employee_id == other.id)).all()
                for shift in shifts:
                    shift.employee_id = primary.id
                    session.add(shift)
                print(f"  - Reassigned {len(shifts)} shifts from {other.id} to {primary.id}")
                
                # 3. Reassign Availabilities
                avails = session.exec(select(Availability).where(Availability.employee_id == other.id)).all()
                for avail in avails:
                    avail.employee_id = primary.id
                    session.add(avail)
                    
                # 4. Merge Data (if primary is missing it)
                if not primary.email and other.email: primary.email = other.email
                if not primary.phone and other.phone: primary.phone = other.phone
                if not primary.hire_date and other.hire_date: primary.hire_date = other.hire_date
                
                # 5. Delete Duplicate
                session.delete(other)
                
            session.add(primary)
            merged_count += 1
        
        session.commit()
        print(f"Merge complete. Merged {merged_count} sets of duplicates.")

if __name__ == "__main__":
    merge_duplicates()
