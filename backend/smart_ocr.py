import pytesseract
from PIL import Image
import glob
import re

KEYWORDS = ["Name", "Phone", "Date", "Hire", "Maintenance", "Senior", "Cashier", "Shift", "Availability", "Notes"]

def count_keywords(text):
    count = 0
    for k in KEYWORDS:
        if k.lower() in text.lower():
            count += 1
    return count

images = sorted(glob.glob("extracted_page_*.tiff"))

for img_path in images:
    print(f"\nProcessing {img_path}...")
    best_text = ""
    best_score = -1
    best_angle = 0
    
    original_img = Image.open(img_path)
    
    for angle in [0, 90, 180, 270]:
        # Rotate
        if angle == 0:
            img = original_img
        else:
            img = original_img.rotate(angle, expand=True)
            
        text = pytesseract.image_to_string(img)
        score = count_keywords(text)
        print(f"  Angle {angle}: Score {score}")
        
        if score > best_score:
            best_score = score
            best_text = text
            best_angle = angle
            
    print(f"Best Angle: {best_angle} (Score: {best_score})")
    print("--- Extracted Text ---")
    print(best_text)
    print("======================")
