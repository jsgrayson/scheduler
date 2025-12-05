
import sys
import os

try:
    from pdf2image import convert_from_path, convert_from_bytes
    print("pdf2image imported successfully")
    
    # Check for poppler
    from pdf2image.exceptions import PDFInfoNotInstalledError
    try:
        # Try to run a dummy command to check for poppler
        import subprocess
        result = subprocess.run(["pdftoppm", "-h"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode == 0:
            print("Poppler (pdftoppm) is installed and found.")
        else:
            print("Poppler (pdftoppm) command failed.")
    except FileNotFoundError:
        print("Poppler (pdftoppm) NOT found in PATH.")
        
except ImportError:
    print("pdf2image module NOT installed.")
except Exception as e:
    print(f"An error occurred: {e}")
