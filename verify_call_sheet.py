import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

def verify():
    # 1. Get a Shift
    print("Fetching shifts...")
    resp = requests.get(f"{BASE_URL}/shifts/", params={"start_date": "2025-12-01", "end_date": "2025-12-31"})
    shifts = resp.json()
    if not shifts:
        print("No shifts found to test.")
        return
        
    # Find a PT Cashier shift or Maintenance shift
    target_shift = None
    for s in shifts:
        # Role 3 (Cashier), 7 (PT Cashier), 4 (Maintenance)
        if s['role_id'] in [3, 7, 4]:
            target_shift = s
            break
            
    if not target_shift:
        print("No suitable shift found (Cashier/Maint). Using first available.")
        target_shift = shifts[0]
        
    print(f"Testing Shift ID: {target_shift['id']} (Role {target_shift['role_id']}, Start: {target_shift['start_time']})")
    
    # 2. Call Endpoint
    url = f"{BASE_URL}/shifts/{target_shift['id']}/call-sheet"
    print(f"Calling {url}...")
    cs_resp = requests.get(url)
    
    if cs_resp.status_code != 200:
        print(f"FAILED: Status {cs_resp.status_code}")
        print(cs_resp.text)
        return
        
    data = cs_resp.json()
    print(f"Received {len(data)} candidates.")
    
    if len(data) > 0:
        print("First 3 candidates:")
        for c in data[:3]:
            print(json.dumps(c, indent=2))
            
        print("Last candidate:")
        print(json.dumps(data[-1], indent=2))
        
        # Verify Notes exist
        notes_found = any(c.get('notes') for c in data)
        print(f"Notes populated in at least one candidate: {notes_found}")
        
    else:
        print("WARNING: Empty call sheet returned.")

if __name__ == "__main__":
    verify()
