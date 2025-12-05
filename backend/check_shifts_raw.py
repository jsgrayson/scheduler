import sqlite3
from datetime import datetime

def check_shifts():
    conn = sqlite3.connect('schedule.db')
    cursor = conn.cursor()
    
    employees_to_check = [
        ('Jochy', 'Jochy'),
        ('Stacian', 'Stacian'),
        ('Paul M', 'Paul'),
        ('Paul Pasquarelli', 'Paul'),
        ('Jim E', 'Jim'),
        ('Jim Quinn', 'Jim'),
        ('Jim Tillona', 'Jim'),
        ('Cindy', 'Cindy')
    ]
    
    print("Checking Shift Counts (Raw SQL)...")
    print("="*40)
    
    for name_label, search_name in employees_to_check:
        # Find employee ID
        cursor.execute("SELECT id, first_name, last_name FROM employee WHERE first_name LIKE ? OR last_name LIKE ?", (f'%{search_name}%', f'%{search_name}%'))
        emps = cursor.fetchall()
        
        for emp_id, first, last in emps:
            full_name = f"{first} {last}"
            if name_label == 'Paul M' and 'Pasquarelli' in last: continue
            if name_label == 'Paul Pasquarelli' and 'Pasquarelli' not in last: continue
            if name_label == 'Jim E' and 'Quinn' in last: continue
            if name_label == 'Jim E' and 'Tillona' in last: continue
            
            cursor.execute("SELECT start_time, location FROM shift WHERE employee_id = ?", (emp_id,))
            shifts = cursor.fetchall()
            
            print(f"Employee: {full_name} (ID: {emp_id})")
            print(f"Total Shifts: {len(shifts)}")
            for start, loc in sorted(shifts):
                dt = datetime.fromisoformat(start)
                print(f"  {dt.strftime('%a %m/%d/%Y %I:%M%p')} @ {loc}")
            print("-" * 20)

    conn.close()

if __name__ == "__main__":
    check_shifts()
