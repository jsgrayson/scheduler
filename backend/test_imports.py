import sys
print(f"Python: {sys.version}")
try:
    import numpy
    print(f"Numpy: {numpy.__version__}")
except ImportError as e:
    print(f"Numpy Import Failed: {e}")

try:
    import cv2
    print(f"OpenCV: {cv2.__version__}")
except ImportError as e:
    print(f"OpenCV Import Failed: {e}")

try:
    import easyocr
    print("EasyOCR Imported Successfully")
except ImportError as e:
    print(f"EasyOCR Import Failed: {e}")
except Exception as e:
    print(f"EasyOCR Init Failed: {e}")
