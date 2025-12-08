#!/usr/bin/env python3
"""
Migrate employee notes to availability_grid.
Parses patterns like:
- "AVAIL 2ND & 3RD"
- "AVAIL TUE THUR FRI SAT"
- "1ST SHIFT ONLY"
- "NO OVERTIME"
- "NO PLAZA"
"""

import sqlite3
import json
import re

DB_PATH = "schedule.db"

DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
SHIFTS = ['1st', '2nd', '3rd']
DAY_ALIASES = {
    'SUNDAY': 'sun', 'SUN': 'sun',
    'MONDAY': 'mon', 'MON': 'mon',
    'TUESDAY': 'tue', 'TUE': 'tue',
    'WEDNESDAY': 'wed', 'WED': 'wed',
    'THURSDAY': 'thu', 'THU': 'thu', 'THUR': 'thu', 'THURS': 'thu',
    'FRIDAY': 'fri', 'FRI': 'fri',
    'SATURDAY': 'sat', 'SAT': 'sat'
}

def parse_notes_to_grid(notes, current_no_overtime, current_no_plaza):
    """Parse notes and return (grid, no_overtime, no_plaza)"""
    if not notes:
        return None, current_no_overtime, current_no_plaza
    
    notes_upper = notes.upper()
    notes_lower = notes.lower()
    
    # Start with all available
    grid = {day: {shift: True for shift in SHIFTS} for day in DAYS}
    
    no_overtime = current_no_overtime
    no_plaza = current_no_plaza
    
    # Check for NO OVERTIME
    if 'no overtime' in notes_lower or 'no ot' in notes_lower or 'do not call for overtime' in notes_lower or 'do not call for extra' in notes_lower:
        no_overtime = True
    
    # Check for NO PLAZA
    if 'no plaza' in notes_lower:
        no_plaza = True
    
    # Parse available shifts
    available_shifts = set()
    if '1st' in notes_lower or '1ST' in notes_upper:
        available_shifts.add('1st')
    if '2nd' in notes_lower or '2ND' in notes_upper:
        available_shifts.add('2nd')
    if '3rd' in notes_lower or '3RD' in notes_upper:
        available_shifts.add('3rd')
    
    # Parse available days
    available_days = set()
    for alias, day in DAY_ALIASES.items():
        if alias in notes_upper:
            available_days.add(day)
    
    # Check for "X ONLY" patterns
    has_only_restriction = 'only' in notes_lower
    
    # Apply shift restrictions
    if available_shifts and has_only_restriction:
        # If "ONLY" is present, restrict to only those shifts
        for day in DAYS:
            for shift in SHIFTS:
                if shift not in available_shifts:
                    grid[day][shift] = False
    elif available_shifts and 'avail' in notes_lower:
        # If "AVAIL" pattern, restrict to mentioned shifts
        for day in DAYS:
            for shift in SHIFTS:
                if shift not in available_shifts:
                    grid[day][shift] = False
    
    # Apply day restrictions
    if available_days and ('avail' in notes_lower or has_only_restriction):
        for day in DAYS:
            if day not in available_days:
                for shift in SHIFTS:
                    grid[day][shift] = False
    
    # Check if we actually parsed something useful
    all_true = all(grid[d][s] for d in DAYS for s in SHIFTS)
    if all_true and not no_overtime and not no_plaza:
        return None, current_no_overtime, current_no_plaza  # No restrictions found
    
    return grid, no_overtime, no_plaza

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get all employees with notes
    cursor.execute("SELECT id, first_name, last_name, notes, no_overtime, no_plaza, availability_grid FROM employee WHERE notes IS NOT NULL AND notes != ''")
    employees = cursor.fetchall()
    
    print(f"Found {len(employees)} employees with notes\n")
    
    updates = []
    for emp_id, first_name, last_name, notes, current_no_ot, current_no_plaza, current_grid in employees:
        grid, no_overtime, no_plaza = parse_notes_to_grid(notes, current_no_ot, current_no_plaza)
        
        if grid or no_overtime != current_no_ot or no_plaza != current_no_plaza:
            print(f"[{emp_id}] {first_name} {last_name}")
            print(f"   Notes: {notes}")
            if grid:
                # Show which days/shifts are restricted
                restrictions = []
                for day in DAYS:
                    for shift in SHIFTS:
                        if not grid[day][shift]:
                            restrictions.append(f"{day.upper()}-{shift}")
                if restrictions:
                    print(f"   Restricted: {', '.join(restrictions)}")
            if no_overtime:
                print(f"   NO OVERTIME: True")
            if no_plaza:
                print(f"   NO PLAZA: True")
            print()
            
            updates.append((emp_id, grid, no_overtime, no_plaza))
    
    if not updates:
        print("No updates needed.")
        return
    
    print(f"\n{len(updates)} employees to update. Proceed? (y/n): ", end="")
    response = input().strip().lower()
    
    if response == 'y':
        for emp_id, grid, no_overtime, no_plaza in updates:
            if grid:
                cursor.execute(
                    "UPDATE employee SET availability_grid = ?, no_overtime = ?, no_plaza = ? WHERE id = ?",
                    (json.dumps(grid), 1 if no_overtime else 0, 1 if no_plaza else 0, emp_id)
                )
            else:
                cursor.execute(
                    "UPDATE employee SET no_overtime = ?, no_plaza = ? WHERE id = ?",
                    (1 if no_overtime else 0, 1 if no_plaza else 0, emp_id)
                )
        
        conn.commit()
        print(f"\n✅ Updated {len(updates)} employees!")
    else:
        print("Cancelled.")
    
    conn.close()

if __name__ == "__main__":
    main()
