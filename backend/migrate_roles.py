from sqlmodel import SQLModel, create_engine, Session, select
from models import Employee, Role, EmployeeRole
from database import engine

def migrate_roles():
    SQLModel.metadata.create_all(engine)
    
    with Session(engine) as session:
        employees = session.exec(select(Employee)).all()
        count = 0
        for emp in employees:
            if emp.default_role_id:
                # Check if link already exists
                existing = session.exec(select(EmployeeRole).where(
                    EmployeeRole.employee_id == emp.id,
                    EmployeeRole.role_id == emp.default_role_id
                )).first()
                
                if not existing:
                    link = EmployeeRole(employee_id=emp.id, role_id=emp.default_role_id)
                    session.add(link)
                    count += 1
        
        session.commit()
        print(f"Migrated {count} default roles to EmployeeRole table.")

if __name__ == "__main__":
    migrate_roles()
