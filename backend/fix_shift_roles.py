from sqlmodel import Session, create_engine, select
from models import Shift, Employee

# Connect to database
engine = create_engine("sqlite:///schedule.db")

with Session(engine) as session:
    # Get all shifts
    shifts = session.exec(select(Shift)).all()
    
    print(f"Found {len(shifts)} shifts to fix")
    
    updated_count = 0
    
    for shift in shifts:
        if shift.employee_id:
            # Get the employee
            employee = session.get(Employee, shift.employee_id)
            
            if employee and employee.default_role_id:
                # Update shift role to match employee's default role
                if shift.role_id != employee.default_role_id:
                    old_role = shift.role_id
                    shift.role_id = employee.default_role_id
                    updated_count += 1
                    if updated_count <= 5:  # Print first few examples
                        print(f"  Updated shift for {employee.first_name} {employee.last_name}: role {old_role} -> {employee.default_role_id}")
    
    # Commit changes
    session.commit()
    
    print(f"\n✅ Updated {updated_count} shift roles to match employee default roles")
    
    # Show role distribution
    roles_count = {}
    for shift in shifts:
        role_id = shift.role_id or 0
        roles_count[role_id] = roles_count.get(role_id, 0) + 1
    
    print("\nRole distribution after fix:")
    for role_id, count in sorted(roles_count.items()):
        print(f"  Role {role_id}: {count} shifts")
