import requests

BASE_URL = "http://localhost:8000"

def test_login():
    print("\n--- Testing Login ---")
    
    # 1. Wrong Password
    resp = requests.post(f"{BASE_URL}/login/", json={"password": "wrong"})
    print(f"Wrong Password Status: {resp.status_code}")
    if resp.status_code == 401:
        print("SUCCESS: Rejected wrong password.")
    else:
        print("FAILURE: Accepted wrong password.")
        
    # 2. Correct Password
    resp = requests.post(f"{BASE_URL}/login/", json={"password": "admin"})
    print(f"Correct Password Status: {resp.status_code}")
    if resp.status_code == 200 and resp.json().get("success"):
        print("SUCCESS: Accepted correct password.")
    else:
        print("FAILURE: Rejected correct password.")

if __name__ == "__main__":
    test_login()
