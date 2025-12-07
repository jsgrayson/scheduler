import pytesseract
from PIL import Image
import os
import glob

# Find extracted images
images = sorted(glob.glob("extracted_page_*.tiff"))

print(f"Found {len(images)} images to OCR.")

for img_path in images:
    print(f"\n--- OCR for {img_path} ---")
    try:
        text = pytesseract.image_to_string(Image.open(img_path))
        print(text)
    except Exception as e:
        print(f"Error processing {img_path}: {e}")
    print("-" * 20)
