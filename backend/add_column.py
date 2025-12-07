from sqlmodel import create_engine, text

engine = create_engine("sqlite:///schedule.db")

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE shift ADD COLUMN is_repeating BOOLEAN DEFAULT 0"))
        conn.commit()
        print("Column is_repeating added successfully.")
    except Exception as e:
        print(f"Error (maybe column exists): {e}")
