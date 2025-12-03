import requests

BASE_URL = "http://localhost:8000"

def test_export():
    print("\n--- Testing Excel Export ---")
    try:
        resp = requests.get(f"{BASE_URL}/export/excel/")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            content_type = resp.headers.get('content-type')
            print(f"Content-Type: {content_type}")
            if 'spreadsheetml' in content_type:
                print("SUCCESS: Received Excel file.")
            else:
                print(f"FAILURE: Unexpected content type: {content_type}")
        else:
            print(f"FAILURE: Status {resp.status_code}")
            print(resp.text)
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test_export()
