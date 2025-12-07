from sqlmodel import Session, create_engine
from models import Shift, Employee, RotationState
from main import get_call_sheet # Import the function directly
import traceback

engine = create_engine("sqlite:///schedule.db")

def test_call_sheet(shift_id):
    with Session(engine) as session:
        try:
            print(f"Testing get_call_sheet for Shift {shift_id}...")
            results = get_call_sheet(shift_id, session)
            print("Success!")
            print(f"Returned {len(results)} candidates.")
            for r in results[:5]:
                print(r)
        except Exception:
            traceback.print_exc()

if __name__ == "__main__":
    test_call_sheet(1)
