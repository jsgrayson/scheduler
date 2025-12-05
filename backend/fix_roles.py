from sqlmodel import Session, select
from database import engine
from models import Employee, Role

def fix_roles():
    with Session(engine) as db:
        # 1. Fix Jochy -> Supervisor
        jochy = db.exec(select(Employee).where(Employee.first_name.ilike("%Jochy%"))).first()
        supervisor_role = db.exec(select(Role).where(Role.name == "Supervisor")).first()
        
        if jochy and supervisor_role:
            print(f"Updating {jochy.first_name} {jochy.last_name} from Role {jochy.default_role_id} to {supervisor_role.id} ({supervisor_role.name})")
            jochy.default_role_id = supervisor_role.id
            db.add(jochy)
        else:
            print("Could not find Jochy or Supervisor role")

        # 2. Fix Stacian -> Cashier
        stacian = db.exec(select(Employee).where(Employee.first_name.ilike("%Stacian%"))).first()
        cashier_role = db.exec(select(Role).where(Role.name == "Cashier")).first()
        
        if stacian and cashier_role:
            print(f"Updating {stacian.first_name} {stacian.last_name} from Role {stacian.default_role_id} to {cashier_role.id} ({cashier_role.name})")
            stacian.default_role_id = cashier_role.id
            db.add(stacian)
        else:
            print("Could not find Stacian or Cashier role")

        db.commit()
        print("Roles updated successfully.")

if __name__ == "__main__":
    fix_roles()
