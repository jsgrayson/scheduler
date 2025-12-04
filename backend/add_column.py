from sqlmodel import text
from database import engine, Session

def add_column():
    with Session(engine) as session:
        try:
            # Check if column exists first to avoid error
            session.exec(text("SELECT willing_to_work_vacation_week FROM employee LIMIT 1"))
            print("Column 'willing_to_work_vacation_week' already exists.")
        except Exception:
            print("Adding column 'willing_to_work_vacation_week'...")
            session.exec(text("ALTER TABLE employee ADD COLUMN willing_to_work_vacation_week BOOLEAN DEFAULT 1"))
            session.commit()
            print("Column added successfully.")

if __name__ == "__main__":
    add_column()
