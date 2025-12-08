#!/usr/bin/env python3
"""
Export cashier employees to Excel for editing.
Run: python3 export_cashiers.py

Creates: cashiers_export.xlsx
"""

import sqlite3
import json

try:
    import openpyxl
except ImportError:
    print("Installing openpyxl...")
    import subprocess
    subprocess.run(["pip3", "install", "openpyxl"])
    import openpyxl

from openpyxl import Workbook

DB_PATH = "schedule.db"
OUTPUT_FILE = "cashiers_export.xlsx"

def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get all cashiers (role_id 3, 7, or 8)
    cursor.execute("""
        SELECT id, first_name, last_name, phone, email, hire_date, 
               is_full_time, max_weekly_hours, notes, 
               no_overtime, no_plaza, is_active, availability_grid
        FROM employee 
        WHERE default_role_id IN (3, 7, 8)
        ORDER BY is_active DESC, last_name, first_name
    """)
    employees = cursor.fetchall()
    
    print(f"Found {len(employees)} cashiers")
    
    # Create Excel workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Cashiers"
    
    # Headers
    headers = [
        "ID", "First Name", "Last Name", "Phone", "Email", "Hire Date",
        "Is Full Time", "Max Weekly Hours", "Notes",
        "No Overtime", "No Plaza", "Is Active",
        "Sun 1st", "Sun 2nd", "Sun 3rd",
        "Mon 1st", "Mon 2nd", "Mon 3rd",
        "Tue 1st", "Tue 2nd", "Tue 3rd",
        "Wed 1st", "Wed 2nd", "Wed 3rd",
        "Thu 1st", "Thu 2nd", "Thu 3rd",
        "Fri 1st", "Fri 2nd", "Fri 3rd",
        "Sat 1st", "Sat 2nd", "Sat 3rd"
    ]
    ws.append(headers)
    
    # Data rows
    days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    shifts = ['1st', '2nd', '3rd']
    
    for emp in employees:
        # Parse availability grid
        grid = {}
        if emp['availability_grid']:
            try:
                grid = json.loads(emp['availability_grid'])
            except:
                pass
        
        # Build row
        row = [
            emp['id'],
            emp['first_name'],
            emp['last_name'],
            emp['phone'],
            emp['email'],
            emp['hire_date'].split('T')[0] if emp['hire_date'] else '',
            'Yes' if emp['is_full_time'] else 'No',
            emp['max_weekly_hours'] or 40,
            emp['notes'] or '',
            'Yes' if emp['no_overtime'] else 'No',
            'Yes' if emp['no_plaza'] else 'No',
            'No' if emp['is_active'] == 0 else 'Yes'  # is_active
        ]
        
        # Add availability grid columns
        for day in days:
            for shift in shifts:
                if day in grid and shift in grid[day]:
                    row.append('Yes' if grid[day][shift] else 'No')
                else:
                    row.append('Yes')  # Default available
        
        ws.append(row)
    
    # Auto-width columns
    for col in ws.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        ws.column_dimensions[column].width = min(max_length + 2, 30)
    
    wb.save(OUTPUT_FILE)
    conn.close()
    
    print(f"\n✅ Exported {len(employees)} cashiers to {OUTPUT_FILE}")
    print("\nEdit the file, then run: python3 import_cashiers.py")

if __name__ == "__main__":
    main()
