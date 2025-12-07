import pytesseract
from PIL import Image
import glob
import re
from datetime import datetime
from sqlmodel import Session, create_engine, select
from models import Employee
import sys

# Setup DB
engine = create_engine("sqlite:///backend/schedule.db")
session = Session(engine)

# Regex for parsing
# Line: Phone Name Date ...
# Phone: 860-687-1971 or 860-6871971 or 1-413-285-5956
# Name: JOHN KARAZK
# Date: 02/10/05 (MM/DD/YY)

pattern = re.compile(r'(\d?[-\s]?\d{3}[-\s]?\d{3}[-\s]?\d{4})\s+([A-Z\s|_\-\.\']{2,})\s+(\d{2}/\d{2}/\d{2})\s*(.*)')

def parse_date(date_str):
    try:
        # MM/DD/YY
        dt = datetime.strptime(date_str, "%m/%d/%y")
        # Fix year century
        if dt.year > datetime.now().year + 1: # e.g. 2099
            dt = dt.replace(year=dt.year - 100)
        return dt
    except:
        return None

def normalize_phone(p):
    # Remove dashes/spaces
    digits = re.sub(r'\D', '', p)
    if len(digits) == 10:
        return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"
    if len(digits) == 11 and digits.startswith('1'):
        return f"{digits[1:4]}-{digits[4:7]}-{digits[7:]}" # dropping country code 1
    return p

# Load all employees for matching
all_emps = session.exec(select(Employee)).all()
emp_map = {} # last_lower -> [emp]
for e in all_emps:
    l = e.last_name.lower().strip()
    if l not in emp_map: emp_map[l] = []
    emp_map[l].append(e)

# Nickname map
nicknames = {
    "mike": "michael", "michael": "mike",
    "matt": "matthew", "matthew": "matt",
    "tom": "thomas", "thomas": "tom",
    "dan": "daniel", "daniel": "dan",
    "jim": "james", "james": "jim",
    "joe": "joseph", "joseph": "joe",
    "jen": "jennifer", "jennifer": "jen",
    "steve": "stephen", "stephen": "steve",
    "dave": "david", "david": "dave",
    "chris": "christopher", "christopher": "chris"
}

images = sorted(glob.glob("extracted_page_*.tiff"))
updates = 0
created = 0

for img_path in images:
    print(f"Processing {img_path}...")
    img = Image.open(img_path).rotate(180, expand=True)
    text = pytesseract.image_to_string(img)
    lines = text.split('\n')
    
    # Determine Page Type
    full_text_lower = text.lower()
    if "maintenance" in full_text_lower and "part time" in full_text_lower:
        default_role_id = 4 # Maintenance
        is_full_time = False
        print("  Detected: PT MAINTENANCE")
    elif "maintenance" in full_text_lower:
        default_role_id = 4 # Maintenance
        is_full_time = True
        print("  Detected: FT MAINTENANCE (Assumed)")
    elif "full time" in full_text_lower and "maintenance" not in full_text_lower:
        default_role_id = 8 # FT Cashier
        is_full_time = True
        print("  Detected: FT CASHIER")
    else:
        # Default to PT Cashier
        default_role_id = 7 # PT Cashier
        is_full_time = False
        print("  Detected: PT CASHIER")

    for line in lines:
        line = line.strip()
        if not line: continue
        
        match = pattern.search(line)
        if match:
            raw_phone, raw_name, raw_date, raw_notes = match.groups()
            name = raw_name.strip()
            notes = raw_notes.strip()
            
            p_date = parse_date(raw_date)
            norm_phone = normalize_phone(raw_phone)
            
            # Find Employee
            found_emp = None
            parts = name.split()
            if len(parts) >= 2:
                last_name_candidate = parts[-1].lower().strip()
                first_name_candidate = parts[0].lower().strip()
                
                candidates = emp_map.get(last_name_candidate, [])
                
                # Check First Name
                for cand in candidates:
                    c_first = cand.first_name.lower().strip()
                    if c_first == first_name_candidate:
                        found_emp = cand
                        break
                    # Nicknames
                    if nicknames.get(first_name_candidate) == c_first or nicknames.get(c_first) == first_name_candidate:
                        found_emp = cand
                        break
            
            if found_emp:
                print(f"    UPDATE: {found_emp.first_name} {found_emp.last_name}")
                found_emp.hire_date = p_date
                found_emp.phone = norm_phone
                found_emp.notes = notes
                session.add(found_emp)
                updates += 1
            else:
                print(f"    CREATE: {name} (Role {default_role_id})")
                
                # Create
                first = parts[0].capitalize()
                last = " ".join(parts[1:]).capitalize() if len(parts) > 1 else ""
                
                new_emp = Employee(
                    first_name=first,
                    last_name=last,
                    phone=norm_phone,
                    hire_date=p_date,
                    notes=notes,
                    default_role_id=default_role_id,
                    is_full_time=is_full_time,
                    willing_to_work_vacation_week=True
                )
                session.add(new_emp)
                created += 1

session.commit()
print(f"Total Updates: {updates}")
print(f"Total Created: {created}")
