from sqlmodel import text
from database import engine, Session

def add_columns():
    with Session(engine) as session:
        # Add max_weekly_hours
        try:
            session.exec(text("SELECT max_weekly_hours FROM employee LIMIT 1"))
            print("Column 'max_weekly_hours' already exists.")
        except Exception:
            print("Adding column 'max_weekly_hours'...")
            session.exec(text("ALTER TABLE employee ADD COLUMN max_weekly_hours FLOAT DEFAULT 40.0"))
            session.commit()
            print("Column 'max_weekly_hours' added.")

        # Add hire_date
        try:
            session.exec(text("SELECT hire_date FROM employee LIMIT 1"))
            print("Column 'hire_date' already exists.")
        except Exception:
            print("Adding column 'hire_date'...")
            session.exec(text("ALTER TABLE employee ADD COLUMN hire_date DATETIME DEFAULT NULL"))
            session.commit()
            print("Column 'hire_date' added.")

if __name__ == "__main__":
    add_columns()
