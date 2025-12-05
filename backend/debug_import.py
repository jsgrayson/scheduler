
import sys
import os
from unittest.mock import MagicMock

# Mock dependencies to avoid full backend setup
sys.modules['sqlmodel'] = MagicMock()
sys.modules['fastapi'] = MagicMock()
sys.modules['pdf2image'] = MagicMock()
sys.modules['PIL'] = MagicMock()
sys.modules['easyocr'] = MagicMock()
sys.modules['numpy'] = MagicMock()
sys.modules['cv2'] = MagicMock()

# Now try to import main to check for syntax/import errors
try:
    import backend.main
    print("Successfully imported backend.main")
except Exception as e:
    print(f"Failed to import backend.main: {e}")
    import traceback
    traceback.print_exc()
