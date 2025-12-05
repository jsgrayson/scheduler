from sqlmodel import Session, select
from database import engine
from models import Employee, Role

def check_employee_roles():
    with Session(engine) as db:
        for name in ["Jochy", "Stacian"]:
            emp = db.exec(select(Employee).where(Employee.first_name.ilike(f"%{name}%"))).first()
            if emp:
                role = db.get(Role, emp.default_role_id)
                print(f"{emp.first_name} {emp.last_name}: Role ID {emp.default_role_id} ({role.name if role else 'Unknown'})")
            else:
                print(f"{name}: Not found")

if __name__ == "__main__":
    check_employee_roles()
