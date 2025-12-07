from sqlmodel import Session, create_engine, select, delete
from models import Employee

engine = create_engine("sqlite:///schedule.db")
session = Session(engine)

new_emps = session.exec(select(Employee).where(Employee.id > 104)).all()
print(f"Found {len(new_emps)} new employees.")

for e in new_emps:
    print(f"Delete: {e.first_name} {e.last_name} (ID {e.id})")
    session.delete(e)

session.commit()
print("Rolled back.")
