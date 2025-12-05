from sqlmodel import Session, create_engine, select
from models import Shift, Employee

# Connect to database
engine = create_engine("sqlite:///schedule.db")

with Session(engine) as session:
    # Get all shifts
    shifts = session.exec(select(Shift)).all()
    
    print(f"Found {len(shifts)} shifts to fix")
    
    # Check current locations
    employee_lot_count = sum(1 for s in shifts if s.location == "Employee Lot")
    print(f"Shifts with 'Employee Lot': {employee_lot_count}")
    
    # We'll restore locations from the OCR import
    # The OCR assigned locations based on the employee's section in the schedule
    
    updated_count = 0
    for shift in shifts:
        if shift.employee_id:
            # Get the employee to check their role/default location
            employee = session.get(Employee, shift.employee_id)
            
            # Map based on role or keep the OCR-assigned location from notes/context
            # For now, let's check what locations the OCR originally assigned
            # by looking at employees in different sections
            
            # If location is wrong (e.g., all say "Employee Lot"), 
            # we can reassign based on role or employee name patterns
            
            if shift.location == "Employee Lot" and employee:
                # This is a placeholder - will need actual logic based on your employees
                # For example, supervisors -> "Supervisors", cashiers -> "Lot 1", etc.
                pass
    
    print(f"\n⚠️  Manual intervention needed!")
    print("Please run this after reviewing the OCR debug log to see original locations.")
    print("Or tell me which employees should be at which locations.")
