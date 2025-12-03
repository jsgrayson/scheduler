import requests
import openpyxl
from io import BytesIO
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def create_dummy_excel():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Employee", "Role", "Date", "Start Time", "End Time", "Notes"])
    
    # Valid Row
    ws.append(["Alice Smith", "Manager", "2025-12-10", "09:00", "17:00", "Regular Shift"])
    
    # Invalid Employee
    ws.append(["Unknown User", "Manager", "2025-12-10", "09:00", "17:00", ""])
    
    # Overlap with Alice's shift above (for validation test later, but here we just test import)
    # Note: Import endpoint doesn't check conflicts, it just imports.
    
    out = BytesIO()
    wb.save(out)
    out.seek(0)
    return out

def test_excel_import():
    print("\n--- Testing Excel Import ---")
    excel_file = create_dummy_excel()
    files = {'file': ('test.xlsx', excel_file, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
    
    response = requests.post(f"{BASE_URL}/import/excel/", files=files)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    
    if response.status_code == 200:
        data = response.json()
        if data['imported_count'] == 1 and len(data['errors']) == 1:
            print("SUCCESS: Imported 1 valid row, rejected 1 invalid row.")
        else:
            print("FAILURE: Unexpected import counts.")

def test_call_sheet_validation():
    print("\n--- Testing Call Sheet Validation ---")
    
    # 1. Get Employee IDs
    emp_resp = requests.get(f"{BASE_URL}/employees/")
    employees = {e['first_name']: e['id'] for e in emp_resp.json()}
    alice_id = employees.get("Alice")
    
    if not alice_id:
        print("Skipping: Alice not found")
        return

    # 2. Create Conflicting Shifts Payload
    # Alice already has a shift Mon 9-17 from seed data
    # Let's propose a shift that overlaps: Mon 16:00 - 20:00
    
    today = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)
    start_of_week = today - timedelta(days=today.weekday()) # Monday
    
    overlap_start = start_of_week + timedelta(hours=16) # 16:00 (overlaps with 09:00-17:00)
    overlap_end = start_of_week + timedelta(hours=20)
    
    # Also propose a massive shift to trigger OT warning
    # 60 hour shift
    long_start = start_of_week + timedelta(days=2)
    long_end = start_of_week + timedelta(days=2, hours=60)
    
    payload = {
        "shifts": [
            {
                "employee_id": alice_id,
                "role_id": 1,
                "start_time": overlap_start.isoformat(),
                "end_time": overlap_end.isoformat()
            },
            {
                "employee_id": alice_id,
                "role_id": 1,
                "start_time": long_start.isoformat(),
                "end_time": long_end.isoformat()
            }
        ]
    }
    
    response = requests.post(f"{BASE_URL}/shifts/validate/", json=payload)
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Response: {data}")
    
    if data['valid'] is False and len(data['conflicts']) > 0:
        print("SUCCESS: Detected conflict.")
    else:
        print("FAILURE: Did not detect conflict.")
        
    if len(data['overtime_warnings']) > 0:
        print("SUCCESS: Detected overtime.")
    else:
        print("FAILURE: Did not detect overtime.")

if __name__ == "__main__":
    test_excel_import()
    test_call_sheet_validation()
