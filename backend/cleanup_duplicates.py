from sqlmodel import Session, create_engine, select
from models import Employee

engine = create_engine("sqlite:///backend/schedule.db")
session = Session(engine)

def clean_name(n):
    return n.replace('|', '').replace('_', '').strip()

# 1. Clean Pipe Chars
emps = session.exec(select(Employee)).all()
for e in emps:
    dirty = False
    if '|' in e.first_name or '_' in e.first_name:
        e.first_name = clean_name(e.first_name)
        dirty = True
    if '|' in e.last_name or '_' in e.last_name:
        e.last_name = clean_name(e.last_name)
        dirty = True
    if dirty:
        print(f"cleaned: {e.first_name} {e.last_name}")
        session.add(e)
session.commit()

# 2. Merge Duplicates (First L vs First Last)
# Reload
emps = session.exec(select(Employee)).all()
short_names = [e for e in emps if len(e.last_name) <= 2] # "P" or "P."
long_names = [e for e in emps if len(e.last_name) > 2]

for short in short_names:
    # Find match in long_names
    # Check First Name match + Last Name starts with Short Last Name char
    if not short.last_name: continue
    short_ln_char = short.last_name[0].lower()
    
    matches = []
    for long in long_names:
        if long.first_name.lower() == short.first_name.lower():
            if long.last_name.lower().startswith(short_ln_char):
                matches.append(long)
    
    if len(matches) == 1:
        long = matches[0]
        print(f"Merging {short.first_name} {short.last_name} (ID {short.id}) into {long.first_name} {long.last_name} (ID {long.id})")
        
        # Move data to Long (or Short? Short has existing shifts? Long has new Hire Date?)
        # Short (ID 20) likely has shifts. Long (ID 125) is new.
        # Outcome: Update Short with Long's Name/Hire/Phone. Delete Long.
        
        short.last_name = long.last_name
        short.phone = long.phone
        short.hire_date = long.hire_date
        short.is_full_time = long.is_full_time # Trust scraper?
        # Role? Keep Short's role if plausible.
        
        session.add(short)
        session.delete(long)
    elif len(matches) > 1:
        print(f"Ambiguous match for {short.first_name} {short.last_name}: {[m.last_name for m in matches]}")

session.commit()
