from sqlmodel import Session, create_engine, select
from models import Shift, Employee, Role
from datetime import datetime, timedelta

# Connect to database
engine = create_engine("sqlite:///schedule.db")

KNOWN_LOCATIONS = [
    "LOT 1", "LOT 2", "LOT 3", "LOT 4", 
    "PLAZA", "CONRAC", "OFFICE", "MAINTENANCE", 
    "SUPERVISORS", "CUSTOMER LOTS", "CASHIER"
]

def get_shift_display(shift, session):
    """Format shift for display"""
    emp = session.get(Employee, shift.employee_id) if shift.employee_id else None
    emp_name = f"{emp.first_name} {emp.last_name}" if emp else "OPEN SHIFT"
    role = session.get(Role, shift.role_id) if shift.role_id else None
    role_name = role.name if role else "No Role"
    date_str = shift.start_time.strftime('%a %m/%d')
    time_str = f"{shift.start_time.strftime('%H:%M')}-{shift.end_time.strftime('%H:%M')}"
    loc = shift.location or "No Location"
    return f"{emp_name:20} | {date_str} {time_str} | {role_name:15} | {loc}"

def main():
    with Session(engine) as session:
        # Get all roles for selection
        roles = session.exec(select(Role)).all()
        role_map = {r.id: r.name for r in roles}
        
        print("=" * 70)
        print("BULK SHIFT EDITOR - Interactive Mode")
        print("=" * 70)
        
        # Date filter
        print("\n📅 Filter by date range (optional):")
        print("   Leave blank for all shifts, or enter date range")
        
        date_from_str = input("   From date (MM/DD or blank): ").strip()
        date_to_str = input("   To date (MM/DD or blank): ").strip()
        
        query = select(Shift).order_by(Shift.start_time)
        
        if date_from_str:
            try:
                month, day = map(int, date_from_str.split('/'))
                date_from = datetime(2025, month, day)
                query = query.where(Shift.start_time >= date_from)
            except:
                print("   Invalid date format, ignoring...")
        
        if date_to_str:
            try:
                month, day = map(int, date_to_str.split('/'))
                date_to = datetime(2025, month, day, 23, 59, 59)
                query = query.where(Shift.start_time <= date_to)
            except:
                print("   Invalid date format, ignoring...")
        
        # Optional: filter by employee
        emp_filter = input("\n👤 Filter by employee name (blank for all): ").strip()
        if emp_filter:
            emp = session.exec(select(Employee).where(
                (Employee.first_name + ' ' + Employee.last_name).contains(emp_filter)
            )).first()
            if emp:
                query = query.where(Shift.employee_id == emp.id)
                print(f"   Filtering for: {emp.first_name} {emp.last_name}")
            else:
                print(f"   Employee '{emp_filter}' not found, showing all")
        
        # Optional: filter by current location
        loc_filter = input("📍 Filter by current location (blank for all): ").strip()
        if loc_filter:
            query = query.where(Shift.location.contains(loc_filter))
        
        # Get shifts
        shifts = session.exec(query).all()
        
        if not shifts:
            print("\n❌ No shifts found matching your filters!")
            return
        
        print(f"\n📋 Found {len(shifts)} shifts:\n")
        print("-" * 70)
        
        # Display shifts with index
        for i, shift in enumerate(shifts):
            print(f" [{i+1:3}] {get_shift_display(shift, session)}")
        
        print("-" * 70)
        
        # Selection
        print("\n🔢 Select shifts to edit:")
        print("   Examples: '1,3,5'  or  '1-10'  or  'all'  or  '1-5,8,10-15'")
        selection = input("   Your selection: ").strip().lower()
        
        if selection == 'all':
            selected_indices = list(range(len(shifts)))
        else:
            selected_indices = []
            parts = selection.split(',')
            for part in parts:
                part = part.strip()
                if '-' in part:
                    try:
                        start, end = map(int, part.split('-'))
                        selected_indices.extend(range(start-1, end))
                    except:
                        pass
                else:
                    try:
                        selected_indices.append(int(part) - 1)
                    except:
                        pass
        
        # Validate indices
        selected_indices = [i for i in selected_indices if 0 <= i < len(shifts)]
        selected_shifts = [shifts[i] for i in selected_indices]
        
        if not selected_shifts:
            print("\n❌ No valid shifts selected!")
            return
        
        print(f"\n✅ Selected {len(selected_shifts)} shifts")
        
        # What to edit?
        print("\n🔧 What do you want to change?")
        print("   1. Role only")
        print("   2. Location only")
        print("   3. Both role AND location")
        
        edit_choice = input("   Choice (1/2/3): ").strip()
        
        new_role_id = None
        new_location = None
        
        # Role selection
        if edit_choice in ['1', '3']:
            print("\n📝 Available Roles:")
            for role in roles:
                print(f"   [{role.id}] {role.name}")
            
            role_input = input("   Enter role ID or name: ").strip()
            
            # Try ID first
            try:
                new_role_id = int(role_input)
                if new_role_id not in role_map:
                    print(f"   ❌ Role ID {new_role_id} not found!")
                    new_role_id = None
            except:
                # Try name match
                for role in roles:
                    if role_input.lower() in role.name.lower():
                        new_role_id = role.id
                        print(f"   Matched: {role.name}")
                        break
                if not new_role_id:
                    print(f"   ❌ Role '{role_input}' not found!")
        
        # Location selection
        if edit_choice in ['2', '3']:
            print("\n📍 Known Locations:")
            for i, loc in enumerate(KNOWN_LOCATIONS):
                print(f"   [{i+1}] {loc}")
            print("   [0] Custom location")
            
            loc_input = input("   Enter # or custom location: ").strip()
            
            try:
                loc_num = int(loc_input)
                if 1 <= loc_num <= len(KNOWN_LOCATIONS):
                    new_location = KNOWN_LOCATIONS[loc_num - 1]
                elif loc_num == 0:
                    new_location = input("   Enter custom location: ").strip()
            except:
                new_location = loc_input  # Use as-is
            
            if new_location:
                print(f"   New location: {new_location}")
        
        # Validation
        if edit_choice == '1' and not new_role_id:
            print("\n❌ No valid role selected!")
            return
        if edit_choice == '2' and not new_location:
            print("\n❌ No valid location entered!")
            return
        if edit_choice == '3' and not (new_role_id or new_location):
            print("\n❌ No valid changes specified!")
            return
        
        # Preview
        print("\n" + "=" * 70)
        print("📋 CHANGES PREVIEW:")
        print("=" * 70)
        
        for shift in selected_shifts[:10]:
            old_display = get_shift_display(shift, session)
            changes = []
            if new_role_id:
                changes.append(f"role → {role_map[new_role_id]}")
            if new_location:
                changes.append(f"location → {new_location}")
            print(f"  {old_display}")
            print(f"      ↳ {', '.join(changes)}")
        
        if len(selected_shifts) > 10:
            print(f"  ... and {len(selected_shifts) - 10} more shifts")
        
        print("=" * 70)
        
        # Confirm
        confirm = input(f"\n⚠️  Apply changes to {len(selected_shifts)} shifts? (yes/no): ").strip().lower()
        
        if confirm != 'yes':
            print("❌ Cancelled.")
            return
        
        # Apply changes
        updated = 0
        for shift in selected_shifts:
            if new_role_id:
                shift.role_id = new_role_id
            if new_location:
                shift.location = new_location
            session.add(shift)
            updated += 1
        
        session.commit()
        print(f"\n✅ Successfully updated {updated} shifts!")

if __name__ == "__main__":
    main()
