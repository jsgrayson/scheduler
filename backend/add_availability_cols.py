"""Add availability_grid and no_overtime columns to Employee table."""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "scheduler.db")

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if columns exist
    cursor.execute("PRAGMA table_info(employee)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if "availability_grid" not in columns:
        print("Adding availability_grid column...")
        cursor.execute("ALTER TABLE employee ADD COLUMN availability_grid TEXT")
    else:
        print("availability_grid column already exists")
    
    if "no_overtime" not in columns:
        print("Adding no_overtime column...")
        cursor.execute("ALTER TABLE employee ADD COLUMN no_overtime BOOLEAN DEFAULT 0")
    else:
        print("no_overtime column already exists")
    
    conn.commit()
    conn.close()
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
