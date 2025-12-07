from sqlmodel import create_engine, text

engine = create_engine("sqlite:///backend/schedule.db")

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE employee ADD COLUMN willing_to_work_vacation_week BOOLEAN DEFAULT 1"))
        print("Added willing_to_work_vacation_week")
    except Exception as e:
        print(f"willing error: {e}")

    try:
        conn.execute(text("ALTER TABLE employee ADD COLUMN hire_date DATETIME"))
        print("Added hire_date")
    except Exception as e:
        print(f"hire_date error: {e}")

    try:
        conn.execute(text("ALTER TABLE employee ADD COLUMN last_call_time DATETIME"))
        print("Added last_call_time")
    except Exception as e:
        print(f"last_call_time error: {e}")
        
    try:
        conn.execute(text("ALTER TABLE employee ADD COLUMN notes TEXT"))
        print("Added notes")
    except Exception as e:
        print(f"notes error: {e}")
        
    conn.commit()
