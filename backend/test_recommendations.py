import requests
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def test_recommendations():
    print("\n--- Testing Smart Recommendations ---")
    
    # 1. Get Roles
    roles_resp = requests.get(f"{BASE_URL}/roles/")
    roles = {r['name']: r['id'] for r in roles_resp.json()}
    server_role_id = roles.get("Server")
    
    if not server_role_id:
        print("Skipping: Server role not found")
        return

    # 2. Query Recommendations for a Server shift
    # Time: Wednesday 18:00 - 22:00
    # Context:
    # - Bob (Server) is available Mon-Fri evenings, but already has a shift Wed 11-19 (Conflict!)
    # - David (Server) has a shift Wed 17-22 (Conflict!)
    # - Eve (Server) is free (Shift Thu 9-17)
    
    today = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)
    start_of_week = today - timedelta(days=today.weekday()) # Monday
    
    # Wednesday
    target_start = start_of_week + timedelta(days=2, hours=18)
    target_end = start_of_week + timedelta(days=2, hours=22)
    
    params = {
        "start_time": target_start.isoformat(),
        "end_time": target_end.isoformat(),
        "role_id": server_role_id
    }
    
    response = requests.get(f"{BASE_URL}/recommendations/", params=params)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        recs = response.json()
        print(f"Found {len(recs)} recommendations.")
        for rec in recs:
            emp = rec['employee']
            print(f"Rank {rec['score']}: {emp['first_name']} {emp['last_name']} - {rec['reasons']}")
            
        # Verification
        # Bob should NOT be here (Conflict 18:00-19:00)
        # David should NOT be here (Conflict 17:00-22:00)
        # Eve SHOULD be here
        
        names = [r['employee']['first_name'] for r in recs]
        if "Eve" in names and "Bob" not in names and "David" not in names:
            print("SUCCESS: Recommendations logic is correct.")
        else:
            print(f"FAILURE: Unexpected results. Names found: {names}")

if __name__ == "__main__":
    test_recommendations()
