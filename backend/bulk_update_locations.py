from sqlmodel import Session, create_engine, select
from models import Shift

# Connect to database
engine = create_engine("sqlite:///schedule.db")

# Define location mapping (edit this to fix your locations)
location_mapping = {
    # Old location name -> New location name
    # Example mappings (customize these based on your needs):
    "Office": "Office",
    "Supervisors": "Supervisors",
    "Customer Lots": "Customer Lots",
    "Maintenance": "Maintenance",
    "Lot 1": "Lot 1",
    "Lot 2": "Lot 2",
    "Lot 3": "Lot 3",
    "Lot 4": "Lot 4",
    "Plaza": "Plaza",
    "Conrac": "Conrac",
    # Add more mappings here as needed
    # "Old Name": "New Name",
}

with Session(engine) as session:
    # Get all shifts
    shifts = session.exec(select(Shift)).all()
    
    updated_count = 0
    
    for shift in shifts:
        if shift.location in location_mapping:
            new_location = location_mapping[shift.location]
            if shift.location != new_location:
                shift.location = new_location
                updated_count += 1
    
    # Commit changes
    session.commit()
    
    print(f"✅ Updated {updated_count} shift locations")
    
    # Show current location distribution
    locations = {}
    for shift in shifts:
        loc = shift.location or "NULL"
        locations[loc] = locations.get(loc, 0) + 1
    
    print("\nCurrent location distribution:")
    for loc, count in sorted(locations.items()):
        print(f"  {loc}: {count} shifts")
