import requests
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def test_recurrence_vacation():
    print("\n--- Testing Recurrence & Vacation ---")
    
    # 1. Get Employee & Role
    roles = requests.get(f"{BASE_URL}/roles/").json()
    role_id = roles[0]['id']
    employees = requests.get(f"{BASE_URL}/employees/").json()
    emp_id = employees[0]['id']
    
    start_time = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=1)
    end_time = start_time + timedelta(hours=8)
    
    # 2. Create Weekly Recurring Shift
    print("Creating Weekly Shift...")
    payload = {
        "employee_id": emp_id,
        "role_id": role_id,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "repeat": "weekly",
        "notes": "Weekly Meeting"
    }
    resp = requests.post(f"{BASE_URL}/shifts/", json=payload)
    if resp.status_code == 200:
        shifts = resp.json()
        print(f"SUCCESS: Created {len(shifts)} shifts (Expected ~4-5 for 28 days).")
    else:
        print(f"FAILURE: {resp.text}")
        
    # 3. Create Vacation with Cover
    print("Creating Vacation with Cover...")
    vac_start = start_time + timedelta(days=2)
    vac_end = vac_start + timedelta(hours=8)
    
    payload = {
        "employee_id": emp_id,
        "role_id": role_id,
        "start_time": vac_start.isoformat(),
        "end_time": vac_end.isoformat(),
        "is_vacation": True,
        "create_open_shift": True,
        "notes": "Vacation Day"
    }
    resp = requests.post(f"{BASE_URL}/shifts/", json=payload)
    if resp.status_code == 200:
        shifts = resp.json()
        print("DEBUG: Response keys:", shifts[0].keys() if shifts else "Empty list")
        # Expect 2 shifts: 1 Vacation (emp), 1 Open (None)
        vacation = next((s for s in shifts if s.get('is_vacation')), None)
        cover = next((s for s in shifts if s.get('employee_id') is None), None)
        
        if vacation and cover:
            print("SUCCESS: Created Vacation and Cover shift.")
        else:
            print("FAILURE: Missing Vacation or Cover shift.")
            print("Vacation shift found:", vacation)
            print("Cover shift found:", cover)
    else:
        print(f"FAILURE: {resp.text}")

if __name__ == "__main__":
    test_recurrence_vacation()
