from sqlmodel import Session, create_engine, select
from models import Employee, Shift

engine = create_engine("sqlite:///schedule.db")

def merge_employees(session, keep_id, remove_id):
    keep = session.get(Employee, keep_id)
    remove = session.get(Employee, remove_id)
    
    if not keep or not remove:
        print(f"Skipping {keep_id} <- {remove_id}: One not found")
        return

    print(f"Merging {remove.first_name} {remove.last_name} ({remove.id}) INTO {keep.first_name} {keep.last_name} ({keep.id})")

    # Transfer Phone if missing
    if not keep.phone and remove.phone:
        keep.phone = remove.phone
        print(f"  - Transferred Phone: {remove.phone}")
        
    # Transfer Hire Date if missing
    if not keep.hire_date and remove.hire_date:
        keep.hire_date = remove.hire_date
        print(f"  - Transferred Hire Date: {remove.hire_date}")

    # Transfer Notes if missing
    if not keep.notes and remove.notes:
        keep.notes = remove.notes
        print(f"  - Transferred Notes")

    # Reassign Shifts
    shifts = session.exec(select(Shift).where(Shift.employee_id == remove_id)).all()
    count = 0
    for s in shifts:
        s.employee_id = keep_id
        session.add(s)
        count += 1
    print(f"  - Reassigned {count} shifts")

    # Delete Duplicate
    session.delete(remove)
    session.add(keep)

def main():
    with Session(engine) as session:
        # Define merges: (KEEP_ID, REMOVE_ID)
        merges = [
            (35, 136), # Steve Zagorski <- | Steven zagorski
            (35, 146), # Steve Zagorski <- | Steven zagorski (2nd)
            (23, 138), # Winston P <- | Winston patterson |
            (23, 147), # Winston P <- | Winston patterson | (2nd)
            (124, 144), # Tracysmallman <- Tracysmallman
            (66, 125), # Miracle C-Brown <- Miracle Brown
            (64, 134), # Jen Atkins <- Jennipher Atkins
            (128, 145), # Kimberley Stephens <- Kimberley Stephens | _
            (29, 143), # Lotif Raheem <- Lotif Raheen
            (33, 135), # GraceAnn Gordon <- Graceann Gordan
            (65, 121), # John Karzak <- John Karazk
            (25, 137), # Dan R- <- Daniel Ringrose
        ]

        for keep_id, remove_id in merges:
            merge_employees(session, keep_id, remove_id)
        
        session.commit()
        print("Done.")

if __name__ == "__main__":
    main()
