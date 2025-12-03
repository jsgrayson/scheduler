import requests
from PIL import Image, ImageDraw, ImageFont
import io

BASE_URL = "http://localhost:8000"

def create_test_image():
    # Create a simple image with text
    img = Image.new('RGB', (800, 200), color='white')
    d = ImageDraw.Draw(img)
    # Font (default might be too small, but let's try)
    # Text: "Mon Tue Wed Thu Fri Sat Sun"
    #       "Eve 9-5 9-5 9-5 9-5 9-5 OFF OFF"
    
    text = "Mon Tue Wed Thu Fri Sat Sun\nEve 9-5 9-5 9-5 9-5 9-5 OFF OFF"
    d.text((10, 10), text, fill='black')
    
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    return img_byte_arr

def test_ocr():
    print("\n--- Testing OCR Import ---")
    img_data = create_test_image()
    
    files = {'file': ('schedule.png', img_data, 'image/png')}
    
    try:
        resp = requests.post(f"{BASE_URL}/import/ocr/", files=files)
        print(f"Status: {resp.status_code}")
        print(resp.json())
        
        if resp.status_code == 200 and "Imported" in resp.json().get("message", ""):
            print("SUCCESS: OCR endpoint processed image.")
        else:
            print("FAILURE: OCR endpoint failed.")
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test_ocr()
