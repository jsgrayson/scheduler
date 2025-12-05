from sqlmodel import Session, select
from database import engine
from models import Role

def list_roles():
    with Session(engine) as db:
        roles = db.exec(select(Role)).all()
        print("Available Roles:")
        for r in roles:
            print(f"- '{r.name}' (ID: {r.id})")

if __name__ == "__main__":
    list_roles()
