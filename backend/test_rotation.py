import requests
from datetime import datetime

BASE_URL = "http://localhost:8000"

def test_rotation():
    print("\n--- Testing Call Sheet Rotation ---")
    
    # 1. Get Roles
    roles_resp = requests.get(f"{BASE_URL}/roles/")
    roles = {r['name']: r['id'] for r in roles_resp.json()}
    server_role_id = roles.get("Server")
    
    if not server_role_id:
        print("Skipping: Server role not found")
        return

    # 2. Get Rotation for Servers
    response = requests.get(f"{BASE_URL}/callsheet/rotation/", params={"role_id": server_role_id})
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        ft = data['full_time']
        pt = data['part_time']
        
        print(f"Full Time ({len(ft)}):")
        for e in ft:
            last_call = e.get('last_call_time') or "Never"
            print(f"  - {e['first_name']} (Last Called: {last_call})")
            
        print(f"Part Time ({len(pt)}):")
        for e in pt:
            last_call = e.get('last_call_time') or "Never"
            print(f"  - {e['first_name']} (Last Called: {last_call})")
            
        # Verification
        # Eve (FT) has last_call_time=None, should be first in FT list
        # Bob (PT) and David (PT) should be in PT list
        
        if ft[0]['first_name'] == "Eve":
            print("SUCCESS: Eve is first in FT rotation (Never called).")
        else:
            print(f"FAILURE: Expected Eve first, got {ft[0]['first_name']}")
            
        if len(pt) >= 2:
            print("SUCCESS: Found Part Time staff.")
        else:
            print("FAILURE: Missing Part Time staff.")

if __name__ == "__main__":
    test_rotation()
