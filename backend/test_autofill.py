import requests
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def test_autofill():
    print("Testing Auto-Scheduler...")
    
    # 1. Trigger Autofill
    response = requests.post(f"{BASE_URL}/shifts/autofill/")
    if response.status_code != 200:
        print(f"Error: {response.text}")
        return
    
    filled_shifts = response.json()
    print(f"Filled {len(filled_shifts)} shifts.")
    
    # 2. Verify Result
    # We expect the open shift (Wed 20:00) to be assigned to Eve (id=5)
    # Because Bob (id=2) is unavailable after 23:00
    # And David (id=4) has a conflict (17:00-22:00)
    
    found = False
    for shift in filled_shifts:
        if shift['notes'] == "Open Shift - Needs Server":
            found = True
            print(f"Open Shift Assigned To Employee ID: {shift['employee_id']}")
            
            # Fetch employee name
            emp_resp = requests.get(f"{BASE_URL}/employees/")
            employees = {e['id']: e for e in emp_resp.json()}
            assigned_emp = employees.get(shift['employee_id'])
            
            print(f"Assigned To: {assigned_emp['first_name']} {assigned_emp['last_name']}")
            
            if assigned_emp['first_name'] == "Eve":
                print("SUCCESS: Correctly assigned to Eve!")
            else:
                print(f"FAILURE: Assigned to wrong person. Expected Eve.")
                
    if not found:
        print("FAILURE: Open shift was not filled.")

if __name__ == "__main__":
    test_autofill()
