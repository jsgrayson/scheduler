from sqlmodel import Session, select
from database import engine
from models import Role

def seed_roles():
    with Session(engine) as session:
        # Check if Driver role exists
        statement = select(Role).where(Role.name == "Driver")
        driver_role = session.exec(statement).first()
        
        if not driver_role:
            print("Creating 'Driver' role...")
            driver_role = Role(name="Driver", color_hex="#F59E0B") # Amber color
            session.add(driver_role)
            session.commit()
            print("Driver role created successfully.")
        else:
            print("Driver role already exists.")

if __name__ == "__main__":
    seed_roles()
