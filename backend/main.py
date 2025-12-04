from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
from sqlmodel import SQLModel, Session, select, create_engine, delete
from typing import List, Optional
from datetime import datetime, timedelta, time
from database import create_db_and_tables, get_session
from models import Employee, Role, Shift, Availability, EmployeeRole, EmployeeBase
from pydantic import BaseModel

app = FastAPI()

# CORS Middleware (allow all for local dev)
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

KNOWN_LOCATIONS = [
    "LOT 1", "LOT 2", "LOT 3", "LOT 4", 
    "PLAZA", "CONRAC", "OFFICE", "MAINTENANCE", 
    "SUPERVISORS", "CUSTOMER LOTS", "CASHIER"
]

LOCATION_MAPPINGS = {
    "SUP3": "Supervisors",
    # "SUP": "Supervisors", # Too ambiguous, matches "Jim E (Sup)"
    "FLOAT": "Office", 
    "OFF: MGD": "Office",
    "RECPTAR": "Office",
    "ADIAU": "Office",
    "ADMIN": "Office",
    "AFM": "Office",
    "AD": "Office",
    "SUP-MGR": "Maintenance",
    # "SUP": "Maintenance", # Too ambiguous
    "C-LOT": "Customer Lots",
    "CLOT": "Customer Lots",
    "CUSTOMER LOT": "Customer Lots",
}



@app.on_event("startup")
def on_startup():
    create_db_and_tables()

from pydantic import BaseModel, ConfigDict

# --- Employees ---
class EmployeeRead(EmployeeBase):
    id: int
    roles: List[Role] = []

@app.get("/employees/", response_model=List[EmployeeRead])
def read_employees(session: Session = Depends(get_session)):
    employees = session.exec(select(Employee)).all()
    return employees

@app.post("/employees/", response_model=Employee)
def create_employee(employee: Employee, session: Session = Depends(get_session)):
    session.add(employee)
    session.commit()
    session.refresh(employee)
    return employee

# --- Roles ---
class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_full_time: Optional[bool] = None
    default_role_id: Optional[int] = None
    willing_to_work_vacation_week: Optional[bool] = None
    max_weekly_hours: Optional[float] = None
    hire_date: Optional[datetime] = None
    role_ids: Optional[List[int]] = None # New field for multi-role

@app.put("/employees/{employee_id}", response_model=Employee)
def update_employee(employee_id: int, employee_data: EmployeeUpdate, session: Session = Depends(get_session)):
    employee = session.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    hero_data = employee_data.model_dump(exclude_unset=True)
    
    # Handle role_ids separately
    if "role_ids" in hero_data:
        role_ids = hero_data.pop("role_ids")
        # Clear existing roles
        session.exec(delete(EmployeeRole).where(EmployeeRole.employee_id == employee_id))
        # Add new roles
        for rid in role_ids:
            session.add(EmployeeRole(employee_id=employee_id, role_id=rid))
            
    for key, value in hero_data.items():
        setattr(employee, key, value)
        
    session.add(employee)
    session.commit()
    session.refresh(employee)
    return employee

@app.get("/roles/", response_model=List[Role])
def read_roles(session: Session = Depends(get_session)):
    roles = session.exec(select(Role)).all()
    return roles

# --- Shifts ---
@app.get("/shifts/", response_model=List[Shift])
def read_shifts(
    start_date: datetime,
    end_date: datetime,
    session: Session = Depends(get_session)
):
    statement = select(Shift).where(Shift.start_time >= start_date).where(Shift.end_time <= end_date)
    shifts = session.exec(statement).all()
    return shifts

class ShiftCreate(BaseModel):
    employee_id: Optional[int] = None
    role_id: int
    start_time: datetime
    end_time: datetime
    notes: Optional[str] = None
    location: Optional[str] = None
    is_vacation: bool = False
    repeat: Optional[str] = None # "daily", "weekly", "mon-fri"
    create_open_shift: bool = False # If vacation, create covering open shift

class ShiftRead(BaseModel):
    id: int
    employee_id: Optional[int]
    role_id: int
    start_time: datetime
    end_time: datetime
    notes: Optional[str] = None
    location: Optional[str] = None
    is_vacation: bool
    parent_id: Optional[int] = None

@app.post("/shifts/", response_model=List[ShiftRead])
def create_shift(shift_data: ShiftCreate, session: Session = Depends(get_session)):
    # 1. Base Shift Data
    shifts_to_create = []
    
    # Calculate duration
    duration = shift_data.end_time - shift_data.start_time
    
    # Determine start dates based on recurrence
    start_dates = [shift_data.start_time]
    
    if shift_data.repeat:
        # Generate for next 4 weeks (28 days)
        current = shift_data.start_time
        for _ in range(28): # Check next 28 days
            current += timedelta(days=1)
            
            should_add = False
            if shift_data.repeat == "daily":
                should_add = True
            elif shift_data.repeat == "weekly":
                if current.weekday() == shift_data.start_time.weekday():
                    should_add = True
            elif shift_data.repeat == "mon-fri":
                if current.weekday() < 5:
                    should_add = True
            
            if should_add:
                start_dates.append(current)
                
    # Create Shift Objects
    parent_id = None # Will be set to first shift's ID if repeating
    
    created_shifts = []
    
    for i, start_dt in enumerate(start_dates):
        end_dt = start_dt + duration
        
        # Conflict Check (Skip for Vacation? Maybe warn but allow? Let's check for now)
        # If vacation, we might want to allow it even if there's a work shift (and maybe delete work shift?)
        # For MVP, simple check.
        
        # Create Shift
        shift = Shift(
            employee_id=shift_data.employee_id,
            role_id=shift_data.role_id,
            start_time=start_dt,
            end_time=end_dt,
            notes=shift_data.notes,
            is_vacation=shift_data.is_vacation,
            parent_id=parent_id
        )
        session.add(shift)
        session.commit()
        session.refresh(shift)
        
        if i == 0 and len(start_dates) > 1:
            parent_id = shift.id
            shift.parent_id = shift.id # Self-reference for parent
            session.add(shift)
            session.commit()
            
        created_shifts.append(shift)
        
        # Handle Vacation Cover
        if shift_data.is_vacation and shift_data.create_open_shift:
            # Create Open Shift
            open_shift = Shift(
                employee_id=None, # Open
                role_id=shift_data.role_id,
                start_time=start_dt,
                end_time=end_dt,
                notes=f"Cover for {shift_data.notes or 'Vacation'}"
            )
            session.add(open_shift)
            session.commit()
            created_shifts.append(open_shift)
            
            created_shifts.append(open_shift)
            
    return created_shifts

@app.get("/shifts/agenda/{employee_id}", response_model=List[Shift])
def get_agenda(employee_id: int, session: Session = Depends(get_session)):
    # Get future shifts for employee
    now = datetime.now()
    statement = select(Shift).where(
        Shift.employee_id == employee_id,
        Shift.start_time >= now
    ).order_by(Shift.start_time)
    shifts = session.exec(statement).all()
    return shifts

@app.put("/shifts/{shift_id}", response_model=Shift)
def update_shift(shift_id: int, shift_data: Shift, session: Session = Depends(get_session)):
    shift = session.get(Shift, shift_id)
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    
    # Conflict detection (excluding self, and only if employee assigned)
    if shift_data.employee_id:
        statement = select(Shift).where(
            Shift.employee_id == shift_data.employee_id,
            Shift.start_time < shift_data.end_time,
            Shift.end_time > shift_data.start_time,
            Shift.id != shift_id
        )
        conflicts = session.exec(statement).all()
        if conflicts:
            raise HTTPException(status_code=400, detail="Shift overlaps with an existing shift.")
        
    shift.start_time = shift_data.start_time
    shift.end_time = shift_data.end_time
    shift.role_id = shift_data.role_id
    shift.employee_id = shift_data.employee_id # Can be None
    shift.notes = shift_data.notes
    
    session.add(shift)
    session.commit()
    session.refresh(shift)
    return shift

@app.delete("/shifts/{shift_id}")
def delete_shift(shift_id: int, session: Session = Depends(get_session)):
    shift = session.get(Shift, shift_id)
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    session.delete(shift)
    session.commit()
    return {"ok": True}

# --- Availability ---
from models import Availability

@app.get("/availability/", response_model=List[Availability])
def read_availability(employee_id: Optional[int] = None, session: Session = Depends(get_session)):
    if employee_id:
        statement = select(Availability).where(Availability.employee_id == employee_id)
    else:
        statement = select(Availability)
    return session.exec(statement).all()

@app.post("/availability/", response_model=Availability)
def create_availability(avail: Availability, session: Session = Depends(get_session)):
    session.add(avail)
    session.commit()
    session.refresh(avail)
    return avail

# --- Auto-Scheduler ---
@app.post("/shifts/autofill/", response_model=List[Shift])
def autofill_shifts(session: Session = Depends(get_session)):
    # 1. Get all open shifts
    open_shifts = session.exec(select(Shift).where(Shift.employee_id == None)).all()
    
    filled_shifts = []
    
    for shift in open_shifts:
        # Get potential candidates with matching role
        candidates = session.exec(select(Employee).where(Employee.default_role_id == shift.role_id)).all()
        
        best_candidate = None
        
        for employee in candidates:
            # --- Check 1: Conflicts ---
            conflict = session.exec(select(Shift).where(
                Shift.employee_id == employee.id,
                Shift.start_time < shift.end_time,
                Shift.end_time > shift.start_time
            )).first()
            if conflict:
                continue

            # --- Check 2: Availability ---
            # Get availability for this day of week (0=Mon, 6=Sun)
            day_of_week = shift.start_time.weekday()
            availabilities = session.exec(select(Availability).where(
                Availability.employee_id == employee.id,
                Availability.day_of_week == day_of_week
            )).all()
            
            is_available = True
            
            # If there are "Available" (True) records, shift MUST fit inside one
            positive_avail = [a for a in availabilities if a.is_available]
            if positive_avail:
                fits_in_slot = False
                shift_start_str = shift.start_time.strftime("%H:%M")
                shift_end_str = shift.end_time.strftime("%H:%M")
                
                for slot in positive_avail:
                    if slot.start_time <= shift_start_str and slot.end_time >= shift_end_str:
                        fits_in_slot = True
                        break
                if not fits_in_slot:
                    is_available = False
            
            # If there are "Unavailable" (False) records, shift MUST NOT overlap
            negative_avail = [a for a in availabilities if not a.is_available]
            for slot in negative_avail:
                shift_start_str = shift.start_time.strftime("%H:%M")
                shift_end_str = shift.end_time.strftime("%H:%M")
                
                # Check overlap: start < slot_end AND end > slot_start
                if shift_start_str < slot.end_time and shift_end_str > slot.start_time:
                    is_available = False
                    break
            
            if not is_available:
                continue

            # --- Check 3: Weekly Hours Cap ---
            if employee.max_weekly_hours:
                shift_start = shift.start_time
                start_of_week = shift_start - timedelta(days=shift_start.weekday())
                start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
                end_of_week = start_of_week + timedelta(days=7)
                
                weekly_shifts = session.exec(select(Shift).where(
                    Shift.employee_id == employee.id,
                    Shift.start_time >= start_of_week,
                    Shift.end_time < end_of_week
                )).all()
                
                current_hours = sum((s.end_time - s.start_time).total_seconds() / 3600 for s in weekly_shifts)
                new_shift_hours = (shift.end_time - shift.start_time).total_seconds() / 3600
                
                if current_hours + new_shift_hours > employee.max_weekly_hours:
                    continue

            # If we passed all checks, assign this employee
            # (Simple logic: take the first valid one. Could be optimized to balance hours)
            best_candidate = employee
            break
        
        if best_candidate:
            shift.employee_id = best_candidate.id
            session.add(shift)
            filled_shifts.append(shift)
    
    session.commit()
    for s in filled_shifts:
        session.refresh(s)
        
    return filled_shifts

# --- Excel Import ---
from io import BytesIO
import openpyxl
from dateutil import parser

@app.post("/import/excel/")
async def import_excel(file: UploadFile = File(...), session: Session = Depends(get_session)):
    contents = await file.read()
    wb = openpyxl.load_workbook(BytesIO(contents))
    sheet = wb.active
    
    imported_count = 0
    errors = []
    
    # Assuming headers in row 1: Employee, Role, Date, Start Time, End Time, Notes
    for i, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
        if not row[0]: continue # Skip empty rows
        
        emp_name, role_name, date_str, start_str, end_str, notes = row[0], row[1], row[2], row[3], row[4], row[5] if len(row) > 5 else None
        
        # 1. Find Employee
        # Split name "First Last"
        parts = str(emp_name).split(" ", 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""
        
        print(f"DEBUG: Looking for Employee '{first_name}' '{last_name}'")
        employee = session.exec(select(Employee).where(Employee.first_name == first_name, Employee.last_name == last_name)).first()
        print(f"DEBUG: Found: {employee}")
        
        if not employee:
            errors.append(f"Row {i}: Employee '{emp_name}' not found.")
            continue
            
        # 2. Find Role
        role = session.exec(select(Role).where(Role.name == role_name)).first()
        if not role:
            errors.append(f"Row {i}: Role '{role_name}' not found.")
            continue
            
        # 3. Parse Times
        try:
            # Handle various date/time formats from Excel
            # If date_str is already a datetime object (openpyxl does this), use it
            base_date = date_str if isinstance(date_str, datetime) else parser.parse(str(date_str))
            
            # Combine date with time
            # start_str might be a time object or string
            if isinstance(start_str, datetime): # Sometimes Excel returns datetime for time cells
                start_time = start_str
            elif hasattr(start_str, 'hour'): # time object
                start_time = base_date.replace(hour=start_str.hour, minute=start_str.minute)
            else:
                t = parser.parse(str(start_str)).time()
                start_time = base_date.replace(hour=t.hour, minute=t.minute)
                
            if isinstance(end_str, datetime):
                end_time = end_str
            elif hasattr(end_str, 'hour'):
                end_time = base_date.replace(hour=end_str.hour, minute=end_str.minute)
            else:
                t = parser.parse(str(end_str)).time()
                end_time = base_date.replace(hour=t.hour, minute=t.minute)
                
            # Handle overnight shifts (end time < start time)
            if end_time < start_time:
                end_time += timedelta(days=1)
                
        except Exception as e:
            errors.append(f"Row {i}: Invalid date/time format. {e}")
            continue
            
        # Create Shift
        shift = Shift(
            employee_id=employee.id,
            role_id=role.id,
            start_time=start_time,
            end_time=end_time,
            notes=notes
        )
        session.add(shift)
        imported_count += 1
        
    # Commit whatever was added (partial success)
    session.commit()
    
    # Return success with list of errors if any
    return {"message": "Import process completed", "imported_count": imported_count, "errors": errors}

# --- Call Sheet / Validation ---
from pydantic import BaseModel

class ValidationRequest(BaseModel):
    shifts: List[Shift] # List of proposed shifts (some might not have IDs yet)

@app.post("/shifts/validate/")
def validate_shifts(request: ValidationRequest, session: Session = Depends(get_session)):
    report = {
        "valid": True,
        "conflicts": [],
        "overtime_warnings": []
    }
    
    # Group proposed shifts by employee for OT calc
    emp_hours = {} # {emp_id: total_hours}
    
    # 1. Pre-load existing hours for the relevant week(s)
    # For simplicity, we'll just calculate based on the proposed shifts + existing shifts in DB
    # This is a complex check, let's do a per-shift check
    
    for idx, shift in enumerate(request.shifts):
        if not shift.employee_id: continue
        
        # Ensure datetimes
        if isinstance(shift.start_time, str):
            shift.start_time = parser.parse(shift.start_time)
        if isinstance(shift.end_time, str):
            shift.end_time = parser.parse(shift.end_time)
            
        # --- Conflict Check ---
        # Check against DB
        db_conflicts = session.exec(select(Shift).where(
            Shift.employee_id == shift.employee_id,
            Shift.start_time < shift.end_time,
            Shift.end_time > shift.start_time,
            Shift.id != shift.id # Exclude self if updating
        )).all()
        
        if db_conflicts:
            report["valid"] = False
            report["conflicts"].append(f"Shift {idx+1} overlaps with existing shift ID {[s.id for s in db_conflicts]}")
            
        # Check against other proposed shifts in this batch
        for other_idx, other_shift in enumerate(request.shifts):
            if idx == other_idx: continue
            if other_shift.employee_id != shift.employee_id: continue
            
            # Ensure datetimes for other shift too (might be redundant but safe)
            other_start = other_shift.start_time
            if isinstance(other_start, str): other_start = parser.parse(other_start)
            other_end = other_shift.end_time
            if isinstance(other_end, str): other_end = parser.parse(other_end)
            
            if (shift.start_time < other_end and shift.end_time > other_start):
                 report["valid"] = False
                 report["conflicts"].append(f"Shift {idx+1} overlaps with proposed shift {other_idx+1}")

        # --- Overtime Check ---
        # Calculate hours for this shift
        duration = (shift.end_time - shift.start_time).total_seconds() / 3600
        
        # Add to accumulator
        if shift.employee_id not in emp_hours:
            # Fetch existing hours for this week from DB
            employee = session.get(Employee, shift.employee_id)
            if not employee: continue
            
            shift_start = shift.start_time
            start_of_week = shift_start - timedelta(days=shift_start.weekday())
            start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_week = start_of_week + timedelta(days=7)
            
            weekly_shifts = session.exec(select(Shift).where(
                Shift.employee_id == shift.employee_id,
                Shift.start_time >= start_of_week,
                Shift.end_time < end_of_week
            )).all()
            
            existing_hours = sum((s.end_time - s.start_time).total_seconds() / 3600 for s in weekly_shifts)
            emp_hours[shift.employee_id] = {
                "total": existing_hours,
                "limit": employee.max_weekly_hours or 40,
                "name": f"{employee.first_name} {employee.last_name}"
            }
            
        emp_hours[shift.employee_id]["total"] += duration

    # Generate OT warnings
    for emp_id, data in emp_hours.items():
        if data["total"] > data["limit"]:
            report["overtime_warnings"].append(
                f"Employee {data['name']} is projected to work {data['total']:.1f} hours (Limit: {data['limit']})"
            )
            
    return report

# --- Smart Recommendations ---
@app.get("/recommendations/")
def get_recommendations(
    start_time: datetime,
    end_time: datetime,
    role_id: Optional[int] = None,
    session: Session = Depends(get_session)
):
    """
    Returns a ranked list of employees for a specific time slot.
    Ranking criteria:
    1. Available (Must be true)
    2. Role Match (Must be true if role_id provided)
    3. No Conflict (Must be true)
    4. Weekly Hours (Prefer < Max)
    5. Daily Hours (Prefer < 8)
    """
    
    # Get candidates
    if role_id:
        candidates = session.exec(select(Employee).where(Employee.default_role_id == role_id)).all()
    else:
        candidates = session.exec(select(Employee)).all()
    # 2. Filter and Score Employees
    recommendations = []
    
    # Calculate start/end of the week for the proposed shift
    # Assuming week starts on Monday
    shift_date = start_time.date()
    start_of_week = shift_date - timedelta(days=shift_date.weekday())
    end_of_week = start_of_week + timedelta(days=6)
    week_start_dt = datetime.combine(start_of_week, datetime.min.time())
    week_end_dt = datetime.combine(end_of_week, datetime.max.time())

    for emp in candidates:
        score = 100
        reasons = []
        is_valid = True
        
        # Check for Vacation in the current week
        # We need to query if this employee has ANY vacation shift this week
        vacation_shifts = session.exec(select(Shift).where(
            Shift.employee_id == emp.id,
            Shift.is_vacation == True,
            Shift.start_time >= week_start_dt,
            Shift.end_time <= week_end_dt
        )).all()
        
        has_vacation_this_week = len(vacation_shifts) > 0
        
        if has_vacation_this_week:
            if emp.is_full_time:
                # FT: No calls if on vacation this week
                is_valid = False
                reasons.append("Full-time employee on vacation this week")
            else:
                # PT: Only if willing
                if not emp.willing_to_work_vacation_week:
                    is_valid = False
                    reasons.append("Part-time employee on vacation this week and not willing to work")
                # If willing, ensure no direct conflict (handled below) and strictly non-vacation day?
                # The direct conflict check below handles the specific time slot.
                # User said: "only on their non vacation shift days".
                # If they have a vacation shift TODAY, they are busy.
                # The conflict check below will catch if the vacation shift overlaps with the proposed time.
                # But if the vacation shift is all day (e.g. 9-5) and we ask for 6-10?
                # If is_vacation is True, usually implies unavailable for work that day?
                # Current implementation: Vacation is a shift with start/end.
                # So conflict check works.
                if is_valid: # Only add reason if still valid
                    reasons.append("Willing to work during vacation week")

        if not is_valid:
            continue # Skip invalid candidates
            
        # 1. Conflict Check
        conflict = session.exec(select(Shift).where(
            Shift.employee_id == emp.id,
            Shift.start_time < end_time,
            Shift.end_time > start_time
        )).first()
        if conflict:
            is_valid = False
            reasons.append("Has conflicting shift")
            
        # 2. Availability Check
        day_of_week = start_time.weekday()
        availabilities = session.exec(select(Availability).where(
            Availability.employee_id == emp.id,
            Availability.day_of_week == day_of_week
        )).all()
        
        # Logic: If ANY positive availability exists, must match one.
        # If ANY negative availability exists, must NOT overlap.
        positive_avail = [a for a in availabilities if a.is_available]
        if positive_avail:
            fits = False
            s_str = start_time.strftime("%H:%M")
            e_str = end_time.strftime("%H:%M")
            for slot in positive_avail:
                if slot.start_time <= s_str and slot.end_time >= e_str:
                    fits = True
                    break
            if not fits:
                is_valid = False
                reasons.append("Outside available hours")
        
        negative_avail = [a for a in availabilities if not a.is_available]
        for slot in negative_avail:
            s_str = start_time.strftime("%H:%M")
            e_str = end_time.strftime("%H:%M")
            if s_str < slot.end_time and e_str > slot.start_time:
                is_valid = False
                reasons.append("During unavailable block")
                break
                
        if not is_valid:
            continue # Skip invalid candidates
            
        # 3. Weekly Hours Check
        start_of_week = start_time - timedelta(days=start_time.weekday())
        start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_week = start_of_week + timedelta(days=7)
        
        weekly_shifts = session.exec(select(Shift).where(
            Shift.employee_id == emp.id,
            Shift.start_time >= start_of_week,
            Shift.end_time < end_of_week
        )).all()
        
        current_weekly_hours = sum((s.end_time - s.start_time).total_seconds() / 3600 for s in weekly_shifts)
        new_shift_hours = (end_time - start_time).total_seconds() / 3600
        projected_weekly = current_weekly_hours + new_shift_hours
        
        if emp.max_weekly_hours and projected_weekly > emp.max_weekly_hours:
            score -= 50
            reasons.append(f"Overtime Risk: {projected_weekly:.1f} / {emp.max_weekly_hours} hrs")
        else:
            reasons.append(f"Weekly: {projected_weekly:.1f} hrs")
            
        # 4. Daily Hours Check
        # Get shifts for just this day
        start_of_day = start_time.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)
        
        daily_shifts = session.exec(select(Shift).where(
            Shift.employee_id == emp.id,
            Shift.start_time >= start_of_day,
            Shift.end_time < end_of_day
        )).all()
        
        current_daily_hours = sum((s.end_time - s.start_time).total_seconds() / 3600 for s in daily_shifts)
        projected_daily = current_daily_hours + new_shift_hours
        
        if projected_daily > 8:
            score -= 20
            reasons.append(f"Long Day: {projected_daily:.1f} hrs")
            
        recommendations.append({
            "employee": emp,
            "score": score,
            "reasons": reasons
        })
        
    # Sort by score desc
    # Sort by score desc, then by Hire Date asc (Seniority)
    # We use a tuple key: (-score, hire_date)
    # -score makes larger scores come first (since we sort ascending by default with this key)
    # hire_date asc makes older dates come first
    recommendations.sort(key=lambda x: (-x["score"], x["employee"].hire_date if x["employee"].hire_date else datetime.max))
    return recommendations

# --- Call Sheet Rotation ---
@app.get("/callsheet/rotation/")
def get_call_rotation(role_id: Optional[int] = None, session: Session = Depends(get_session)):
    """
    Returns employees sorted for call sheet rotation.
    Group 1: Full Time (Sorted by Hire Date)
    Group 2: Part Time + FT < Max Hours (Sorted by Hire Date)
    """
    query = select(Employee)
    if role_id:
        query = query.where(Employee.default_role_id == role_id)
        
    employees = session.exec(query).all()
    
    # Calculate weekly hours for FT employees to see if they should be on PT list
    today = datetime.now()
    start_of_week = today - timedelta(days=today.weekday())
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_week = start_of_week + timedelta(days=7)
    
    full_time = []
    part_time = []
    
    for emp in employees:
        if emp.is_full_time:
            full_time.append(emp)
            
            # Check if under hours
            weekly_shifts = session.exec(select(Shift).where(
                Shift.employee_id == emp.id,
                Shift.start_time >= start_of_week,
                Shift.end_time < end_of_week
            )).all()
            
            hours = sum((s.end_time - s.start_time).total_seconds() / 3600 for s in weekly_shifts)
            max_hours = emp.max_weekly_hours if emp.max_weekly_hours else 40.0
            
            if hours < max_hours:
                # Add to PT list for extra shifts
                # We clone or just append? Appending is fine, frontend handles display.
                # Maybe add a flag or note?
                part_time.append(emp)
        else:
            part_time.append(emp)
    
    # Sort by Hire Date (Seniority = Oldest First)
    # Handle None hire_date (put at end)
    def sort_key(e):
        return e.hire_date if e.hire_date else datetime.max
        
    full_time.sort(key=sort_key)
    part_time.sort(key=sort_key)
    
    # Apply Rotation to Full Time List
    # "Start at the person after the last call"
    # 1. Find the employee with the most recent last_call_time
    last_called_emp = None
    most_recent_time = datetime.min
    
    for emp in full_time:
        if emp.last_call_time and emp.last_call_time > most_recent_time:
            most_recent_time = emp.last_call_time
            last_called_emp = emp
            
    if last_called_emp:
        try:
            # Find index in the seniority-sorted list
            # We use ID to match to avoid object identity issues if session refreshed
            idx = -1
            for i, e in enumerate(full_time):
                if e.id == last_called_emp.id:
                    idx = i
                    break
            
            if idx != -1:
                # Rotate: Elements after idx come first, then elements up to and including idx
                # List: [A, B, C, D] -> Last Called B (idx 1) -> [C, D, A, B]
                full_time = full_time[idx+1:] + full_time[:idx+1]
        except ValueError:
            pass # Should not happen given logic above

    return {
        "full_time": full_time,
        "part_time": part_time
    }

@app.post("/employees/{employee_id}/called/")
def update_last_call(employee_id: int, session: Session = Depends(get_session)):
    employee = session.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    employee.last_call_time = datetime.now()
    session.add(employee)
    session.commit()
    session.refresh(employee)
    return employee

# --- Authentication ---
class LoginRequest(BaseModel):
    password: str

@app.post("/login/")
def login(request: LoginRequest):
    # Simple password check for MVP
    # In production, use hashed passwords and env vars
    CORRECT_PASSWORD = "admin" 
    
    if request.password == CORRECT_PASSWORD:
        return {"success": True, "token": "fake-jwt-token"}
    if request.password == CORRECT_PASSWORD:
        return {"success": True, "token": "fake-jwt-token"}
    else:
        raise HTTPException(status_code=401, detail="Invalid password")

# --- Excel Export ---
from fastapi.responses import StreamingResponse

@app.get("/export/excel/")
def export_excel(session: Session = Depends(get_session)):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Schedule"
    
    # Headers
    headers = ["Employee", "Role", "Date", "Start Time", "End Time", "Notes"]
    ws.append(headers)
    
    # Data
    shifts = session.exec(select(Shift).order_by(Shift.start_time)).all()
    
    for shift in shifts:
        emp_name = f"{shift.employee.first_name} {shift.employee.last_name}" if shift.employee else "OPEN"
        role_name = shift.role.name if shift.role else "Unknown"
        date_str = shift.start_time.strftime("%Y-%m-%d")
        start_str = shift.start_time.strftime("%H:%M")
        end_str = shift.end_time.strftime("%H:%M")
        
        ws.append([emp_name, role_name, date_str, start_str, end_str, shift.notes or ""])
        
    # Auto-adjust column widths
    for col in ws.columns:
        max_length = 0
        column = col[0].column_letter # Get the column name
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(cell.value)
            except:
                pass
        adjusted_width = (max_length + 2)
        ws.column_dimensions[column].width = adjusted_width
        
    # Save to buffer
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    
    headers = {
        'Content-Disposition': 'attachment; filename="schedule_export.xlsx"'
    }
    headers = {
        'Content-Disposition': 'attachment; filename="schedule_export.xlsx"'
    }
    return StreamingResponse(buffer, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

# --- OCR Import ---
import pytesseract
from PIL import Image
import io
from pdf2image import convert_from_bytes
import cv2
import numpy as np
import pillow_heif
import easyocr
import gc

# Register HEIF opener
pillow_heif.register_heif_opener()

# Initialize EasyOCR Reader (loads model into memory once)
# gpu=False to be safe, or True if available. False is safer for general compatibility.
reader = easyocr.Reader(['en'], gpu=False)

def deskew_image(image):
    # Convert PIL to OpenCV
    img_cv = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    
    # Grayscale
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
    
    # Invert (text is usually black on white, we want white on black for contours)
    gray = cv2.bitwise_not(gray)
    
    # Threshold to get text
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
    
    # Find all coordinates of non-zero pixels
    coords = np.column_stack(np.where(thresh > 0))
    
    # Find minimum area rectangle
    angle = cv2.minAreaRect(coords)[-1]
    
    # Correct angle
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle
        
    # Rotate
    (h, w) = img_cv.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(img_cv, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    
    # Convert back to PIL
    return Image.fromarray(cv2.cvtColor(rotated, cv2.COLOR_BGR2RGB))

def correct_orientation(image):
    try:
        osd = pytesseract.image_to_osd(image)
        # More robust parsing - check if rotation info exists
        if '\nRotation: ' in osd:
            rotation_line = osd.split('\nRotation: ')[1].split('\n')[0]
            rotation = int(rotation_line)
            if rotation != 0:
                image = image.rotate(-rotation, expand=True)
                print(f"Rotated image by {-rotation} degrees")
        else:
            print("No rotation info in OSD, using original orientation")
            
    except Exception as e:
        print(f"Orientation detection failed: {e}, using original orientation")
        # Return original image on any error
        pass
    return image

def preprocess_image(image):
    # Convert to grayscale
    gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
    
    # Check dimensions
    height, width = gray.shape
    
    # Only rescale if image is small (e.g. < 2000px width)
    # If it's huge (e.g. 4000px+), downscale or keep as is
    if width < 2000:
        gray = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    elif width > 4000:
        # Downscale slightly to speed up processing without losing much detail for OCR
        gray = cv2.resize(gray, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
    
    # Apply Otsu's thresholding to binarize
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Denoise - reduce strength for speed on large images
    denoised = cv2.fastNlMeansDenoising(thresh, None, 10, 7, 21)
    
    return Image.fromarray(denoised)

@app.post("/import/ocr/")
async def import_ocr(dry_run: bool = False, file: UploadFile = File(...), session: Session = Depends(get_session)):
    print(f"OCR Request Received: {file.filename}, dry_run={dry_run}")
    try:
        contents = await file.read()
        
        # Initialize result containers
        parsed_shifts = []
        errors = []
        unmatched_lines = []
        unmatched_employees = []
        imported_count = 0
        
        # Convert PDF to image if needed
        images = []
        extracted_text = ""
        
        # 1. Try Direct Text Extraction for PDFs
        if file.filename.lower().endswith('.pdf'):
            try:
                from pypdf import PdfReader
                pdf_reader = PdfReader(io.BytesIO(contents))
                raw_text = ""
                for page in pdf_reader.pages:
                    text = page.extract_text()
                    if text:
                        raw_text += text + "\n"
                
                if len(raw_text.strip()) > 50:
                    print("Direct PDF text extraction successful. Skipping OCR.")
                    extracted_text = raw_text
                else:
                    print("PDF has insufficient text (likely scanned). Falling back to OCR.")
                    raise Exception("Insufficient text")
            except Exception as e:
                print(f"Direct text extraction skipped: {e}")
                # Fallback to Image Extraction
                try:
                    images = convert_from_bytes(contents)
                except Exception as e:
                    print(f"pdf2image failed (likely missing poppler): {e}")
                    # Fallback: Try extracting images with pypdf
                    try:
                        from pypdf import PdfReader
                        pdf_reader = PdfReader(io.BytesIO(contents))
                        for page in pdf_reader.pages:
                            for image_file_object in page.images:
                                images.append(Image.open(io.BytesIO(image_file_object.data)))
                        
                        if not images:
                            raise Exception("No images found in PDF (and poppler is missing for rendering text PDFs).")
                        print(f"Successfully extracted {len(images)} images via pypdf fallback.")
                    except Exception as pypdf_error:
                        print(f"pypdf fallback failed: {pypdf_error}")
                        raise Exception("PDF processing failed. Please install 'poppler' (brew install poppler) or upload an image.")
        else:
            images = [Image.open(io.BytesIO(contents))]
            
        # Ensure all images are RGB for OpenCV/EasyOCR compatibility
        if images:
            images = [img.convert('RGB') for img in images]
            
        # Only run OCR if we don't have text yet
        extracted_text = ""
        determined_angle = None
        
        for img in images:
            # 1. Correct Orientation (90/180/270)
            # We still run this fast check as it might catch simple flips
            img = correct_orientation(img)

            # EasyOCR Strategy
            # Convert PIL to bytes or numpy array for EasyOCR
            img_np = np.array(img)
            
            results = []
            
            # 4-Way Rotation Check
            # If we haven't determined the angle yet (first page), run the check
            if determined_angle is None:
                best_results = []
                best_score = -1
                best_angle = 0
                
                import re
                
                for angle in [0, 90, 180, 270]:
                    # Rotate image
                    rotated_img = img.rotate(-angle, expand=True)
                    img_np_rot = np.array(rotated_img)
                    
                    # Run EasyOCR
                    curr_results = reader.readtext(img_np_rot, detail=1, paragraph=False, x_ths=0.5)
                    
                    # Score this orientation
                    score = 0
                    text_content = " ".join([r[1] for r in curr_results])
                    
                    # Check for time patterns (e.g. 9:00, 9-5)
                    time_matches = re.findall(r'\d{1,2}[:\.]?\d{0,2}\s*-\s*\d{1,2}[:\.]?\d{0,2}', text_content)
                    score += len(time_matches) * 2
                    
                    # Check for day names
                    days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
                    day_matches = [d for d in text_content.lower().split() if any(day in d for day in days)]
                    score += len(day_matches)
                    
                    with open("ocr_debug.log", "a") as f:
                        f.write(f"Angle {angle}: Score {score} (Times: {len(time_matches)}, Days: {len(day_matches)})\n")
                    
                    if score > best_score:
                        best_score = score
                        best_results = curr_results
                        best_angle = angle
                
                determined_angle = best_angle
                results = best_results
                
                with open("ocr_debug.log", "a") as f:
                    f.write(f"Determined Document Angle: {determined_angle} with Score {best_score}\n")
            else:
                # Use determined angle for subsequent pages
                if determined_angle != 0:
                    img = img.rotate(-determined_angle, expand=True)
                    img_np = np.array(img)
                
                # Use x_ths=0.5 to prevent merging of close words (like headers)
                results = reader.readtext(img_np, detail=1, paragraph=False, x_ths=0.5)
        
            # Sort by Y
            results.sort(key=lambda x: x[0][0][1])
        
        # Group into lines
            lines_data = [] # List of lists of (bbox, text)
            current_line = []
            last_y = -1
            
            for (bbox, text, prob) in results:
                y = bbox[0][1]
                if last_y == -1:
                    current_line.append((bbox, text))
                    last_y = y
                    continue
                
                if abs(y - last_y) < 35:
                    current_line.append((bbox, text))
                else:
                    current_line.sort(key=lambda x: x[0][0][0])
                    lines_data.append(current_line)
                    current_line = [(bbox, text)]
                    last_y = y
            if current_line:
                current_line.sort(key=lambda x: x[0][0][0])
                lines_data.append(current_line)
                
            # Process Lines for this Page
            
            # --- DEBUG: Save Raw Data for Offline Parsing ---
            import json
            # Convert numpy types to python types for JSON serialization if needed
            # EasyOCR output is usually list of (bbox, text, prob)
            # bbox is list of [x,y] points.
            
            # Helper to serialize
            def serialize_ocr_data(data):
                serializable = []
                for line in data:
                    ser_line = []
                    for (bbox, text) in line:
                        # bbox is list of 4 points [[x,y], [x,y], [x,y], [x,y]]
                        # Convert to list of lists (if it's not already)
                        ser_bbox = [[float(p[0]), float(p[1])] for p in bbox]
                        ser_line.append((ser_bbox, text))
                    serializable.append(ser_line)
                return serializable

            try:
                with open("ocr_raw_output.json", "w") as f:
                    json.dump(serialize_ocr_data(lines_data), f, indent=2)
                print("Saved raw OCR data to ocr_raw_output.json")
            except Exception as e:
                print(f"Failed to save raw debug data: {e}")
            # -----------------------------------------------

            day_columns = [] # List of (x_center, day_index)
            column_dates = {} # Map col_idx -> datetime
            header_y = -1
            current_location = "General" # Default
            
            for line_items in lines_data:
                # Construct full text for regex checks
                full_line_text = " ".join([t[1] for t in line_items])
                
                with open("ocr_debug.log", "a") as f:
                    f.write(f"DEBUG: Raw Line: {full_line_text}\n")
                
                # 0. Check Location
                line_upper = full_line_text.upper()
                import re # Ensure re is available
                
                for loc in KNOWN_LOCATIONS + list(LOCATION_MAPPINGS.keys()):
                    # Use regex to ensure we don't match "Lot 2" inside "Lot 2:45"
                    # We look for the location string, NOT followed by a time separator (: or .)
                    # We also want to match "C-Lot" which might be "C-LOT" or "CLOT"
                    
                    # Escape the location string for regex
                    loc_pattern = re.escape(loc)
                    
                    # Regex: Match loc with word boundaries to avoid partial matches
                    # e.g. "AD" should not match "(Ad)" or "Add"
                    # e.g. "LOT 2" should not match "LOT 2:45"
                    # We use \b for word boundaries, but we also need to handle the case where
                    # the location might be at the start/end of the string or surrounded by non-word chars like ()
                    # However, \b matches between \w and \W. 
                    # "LOT 2" has a space, so \bLOT 2\b works for " LOT 2 "
                    # But "AD" in "(AD)" -> "(" is \W, "A" is \w, so \b matches before A.
                    # "D" is \w, ")" is \W, so \b matches after D.
                    # So \bAD\b matches "(AD)".
                    # But we want to avoid "LOT 2:45". ":" is \W. So \b matches after 2.
                    # So \bLOT 2\b matches "LOT 2:".
                    # We need to explicitly forbid following colon/dot for time-like strings.
                    
                    pattern = rf"\b{loc_pattern}\b(?!\s*[:.])"
                    
                    if re.search(pattern, line_upper):
                        # Check mapping first
                        if loc in LOCATION_MAPPINGS:
                            current_location = LOCATION_MAPPINGS[loc]
                        else:
                            current_location = loc.title()
                            if loc == "CONRAC": current_location = "Conrac"
                            if loc == "PLAZA": current_location = "Plaza"
                            if loc == "LOT 1": current_location = "Lot 1"
                            if loc == "LOT 2": current_location = "Lot 2"
                            if loc == "LOT 3": current_location = "Lot 3"
                            if loc == "LOT 4": current_location = "Lot 4"
                        
                        with open("ocr_debug.log", "a") as f:
                            f.write(f"DEBUG: Found Location Header: {current_location} in line: {full_line_text}\n")
                        break
                    
                # 1. Check Header (Define Columns)
                with open("ocr_debug.log", "a") as f:
                    f.write(f"DEBUG: Finished Location Check for: {full_line_text[:30]}...\n")
                
                days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
                day_matches = []
                
                for (bbox, text) in line_items:
                    # Check if this text block contains day names
                    found_days = [d for d in days if d in text.lower()]
                    
                    # DEBUG: Print EVERYTHING
                    with open("ocr_debug.log", "a") as f:
                        f.write(f"DEBUG: Checking Block: '{text}' (Type: {type(text)}) -> Found: {found_days}\n")

                    if found_days:
                        with open("ocr_debug.log", "a") as f:
                            f.write(f"DEBUG: Header Candidate Block: '{text}' -> Found Days: {found_days}\n")
                        
                        if len(found_days) == 1:
                            # Single day in this block
                            x_center = (bbox[0][0] + bbox[1][0]) / 2
                            day_matches.append((x_center, text))
                        else:
                            # Multiple days merged in one block (e.g. "SATURDAY SUNDAY" or "SATURDAYSUNDAY")
                            words = text.split()
                            
                            # If we have fewer words than found days, it means some are glued together without spaces
                            if len(words) < len(found_days):
                                # Distribute based on found_days count
                                box_width = bbox[1][0] - bbox[0][0]
                                start_x = bbox[0][0]
                                segment_width = box_width / len(found_days)
                                
                                for i, day_name in enumerate(found_days):
                                    # Estimate center for this segment
                                    seg_center = start_x + (segment_width * i) + (segment_width / 2)
                                    day_matches.append((seg_center, day_name))
                            else:
                                # Words are separated by space, but in one block? 
                                # EasyOCR usually splits spaces, but if not:
                                # We can try to map words to days?
                                # For now, let's just use the block center for all (bad) or distribute
                                # Distributing is safer
                                box_width = bbox[1][0] - bbox[0][0]
                                start_x = bbox[0][0]
                                segment_width = box_width / len(found_days)
                                for i, day_name in enumerate(found_days):
                                    seg_center = start_x + (segment_width * i) + (segment_width / 2)
                                    day_matches.append((seg_center, day_name))
                
                if len(day_matches) >= 3:
                    # Found header! Define columns
                    day_columns = sorted(day_matches, key=lambda x: x[0])
                    header_y = line_items[0][0][0][1] # Y of header
                    with open("ocr_debug.log", "a") as f:
                        f.write(f"DEBUG: Defined {len(day_columns)} columns based on header: {[d[1].upper() for d in day_columns]}\n")
                    continue
                
                # 1.5 Check for Date Row (e.g. 12/6/25)
                # If we have columns, check if this line is a date row
                if day_columns and not column_dates:
                    date_matches = []
                    date_regex = r'\d{1,2}/\d{1,2}/\d{2,4}'
                    for (bbox, text) in line_items:
                        found_dates = re.findall(date_regex, text)
                        if found_dates:
                            # If multiple dates in one block?
                            if len(found_dates) == 1:
                                x_center = (bbox[0][0] + bbox[1][0]) / 2
                                date_matches.append((x_center, found_dates[0]))
                            else:
                                # Distribute
                                box_width = bbox[1][0] - bbox[0][0]
                                start_x = bbox[0][0]
                                segment_width = box_width / len(found_dates)
                                for i, d_str in enumerate(found_dates):
                                    seg_center = start_x + (segment_width * i) + (segment_width / 2)
                                    date_matches.append((seg_center, d_str))
                    
                    if len(date_matches) >= 3:
                        # Found a date row! Map to columns
                        with open("ocr_debug.log", "a") as f:
                            f.write(f"DEBUG: Found Date Row with {len(date_matches)} dates\n")
                        
                        for (d_x, d_str) in date_matches:
                            # Find nearest column
                            closest_col_idx = -1
                            min_dist = float('inf')
                            for i, (col_x, col_name) in enumerate(day_columns):
                                dist = abs(d_x - col_x)
                                if dist < min_dist:
                                    min_dist = dist
                                    closest_col_idx = i
                            
                            if closest_col_idx != -1:
                                try:
                                    # Parse date
                                    # Try various formats
                                    for fmt in ["%m/%d/%y", "%m/%d/%Y"]:
                                        try:
                                            dt = datetime.strptime(d_str, fmt)
                                            column_dates[closest_col_idx] = dt
                                            break
                                        except ValueError:
                                            pass
                                except Exception as e:
                                    print(f"Date parse error: {e}")
                        continue
                
                # 2. Process Row (if we have columns defined)
                if day_columns:
                    # We have columns, try to map items to them
                    # Identify Name (Leftmost) vs Time Slots
                    
                    # Heuristic: Name is usually far left, before the first column starts
                    # First column X
                    first_col_x = day_columns[0][0]
                    margin = 50 
                    
                    name_parts = []
                    time_slots = {} 
                    
                    # Calculate average column width for gap detection
                    col_xs = [d[0] for d in day_columns]
                    if len(col_xs) > 1:
                        avg_col_gap = (col_xs[-1] - col_xs[0]) / (len(col_xs) - 1)
                    else:
                        avg_col_gap = 200 # Fallback
                    
                    for (bbox, text) in line_items:
                        x_center = (bbox[0][0] + bbox[1][0]) / 2
                        width = bbox[1][0] - bbox[0][0]
                        
                        if x_center < (first_col_x - margin):
                            name_parts.append(text)
                        else:
                            # Check if block is wide (spans multiple columns)
                            if width > (avg_col_gap * 1.2):
                                # Merged block! Split it.
                                start_x = bbox[0][0]
                                end_x = bbox[1][0]
                                
                                covered_cols = []
                                for k, (col_x, col_name) in enumerate(day_columns):
                                    if start_x - (avg_col_gap/2) <= col_x <= end_x + (avg_col_gap/2):
                                        covered_cols.append(k)
                                
                                if covered_cols:
                                    words = text.split()
                                    # Distribute words
                                    if len(words) >= len(covered_cols):
                                        chunk_size = len(words) / len(covered_cols)
                                        for i, col_idx in enumerate(covered_cols):
                                            s = int(i * chunk_size)
                                            e = int((i + 1) * chunk_size)
                                            chunk = " ".join(words[s:e])
                                            if col_idx in time_slots:
                                                time_slots[col_idx] += " " + chunk
                                            else:
                                                time_slots[col_idx] = chunk
                                    else:
                                        # Not enough word breaks - evenly divide and extract patterns
                                        char_len = len(text)
                                        chunk_size = char_len // len(covered_cols)
                                        
                                        # Pattern to extract time strings (including OCR errors O/0 I/1 S/5)
                                        time_pattern = r'[0-9IO]{1,2}[:.]?[0-9IO]{0,2}[APMS]{0,3}[-–][0-9IO]{1,2}[:.]?[0-9IO]{0,2}[APMS]{0,3}'
                                        
                                        for i, col_idx in enumerate(covered_cols):
                                            start = i * chunk_size
                                            end = (i + 1) * chunk_size if i < len(covered_cols) - 1 else char_len
                                            segment = text[start:end]
                                            
                                            # Try to find a time pattern within this segment
                                            match = re.search(time_pattern, segment, re.IGNORECASE)
                                            if match:
                                                chunk = match.group()
                                            else:
                                                chunk = segment.strip()
                                            
                                            if col_idx in time_slots:
                                                time_slots[col_idx] += " " + chunk
                                            else:
                                                time_slots[col_idx] = chunk
                                else:
                                    # Fallback to center mapping
                                    closest_col_idx = -1
                                    min_dist = float('inf')
                                    for k, (col_x, col_name) in enumerate(day_columns):
                                        dist = abs(x_center - col_x)
                                        if dist < min_dist:
                                            min_dist = dist
                                            closest_col_idx = k
                                    if closest_col_idx != -1:
                                        if closest_col_idx in time_slots:
                                            time_slots[closest_col_idx] += " " + text
                                        else:
                                            time_slots[closest_col_idx] = text
                            else:
                                # Normal mapping (not wide)
                                closest_col_idx = -1
                                min_dist = float('inf')
                                for k, (col_x, col_name) in enumerate(day_columns):
                                    dist = abs(x_center - col_x)
                                    if dist < min_dist:
                                        min_dist = dist
                                        closest_col_idx = k
                                
                                if closest_col_idx != -1:
                                    # Check distance
                                    if min_dist < (avg_col_gap * 0.6):
                                        if closest_col_idx in time_slots:
                                            time_slots[closest_col_idx] += " " + text
                                        else:
                                            time_slots[closest_col_idx] = text

                    full_name = " ".join(name_parts).replace('_', ' ').strip()
                    # Remove trailing dots/chars
                    full_name = re.sub(r'[.:,]+$', '', full_name).strip()
                    
                    if not full_name: continue
                    
                    # Match Employee
                    first_word = full_name.split()[0]
                    employee = session.exec(select(Employee).where(Employee.first_name.ilike(first_word))).first()
                    
                    with open("ocr_debug.log", "a") as f:
                        f.write(f"DEBUG: Processing Row: '{full_name}' -> Employee Match: {employee.first_name if employee else 'None'} (Loc: {current_location})\n")
                    
                    # Define helper once
                    def parse_ocr_time(t_str):
                        # OCR Error Correction BEFORE parsing
                        t_str = t_str.strip().upper()
                        
                        # Common OCR mistakes
                        t_str = t_str.replace('S', '5')  # 9:4SAM → 9:45AM
                        t_str = t_str.replace('O', '0')  # 1O:15 → 10:15
                        t_str = t_str.replace(';', ':')  # 11;15 → 11:15
                        t_str = t_str.replace('.', ':')  # 9.45 → 9:45
                        # Smart space handling: convert "5 0P" to "5:0P" before removing spaces
                        # This prevents "5 0P" → "50P" (hour=50 error)
                        t_str = re.sub(r'(\d)\s+(\d)', r'\1:\2', t_str)  # digit-space-digit → digit:digit
                        t_str = t_str.replace(' ', '')   # Now safe to remove remaining spaces
                        t_str = t_str.replace('I', '1')  # I0:15 → 10:15
                        t_str = t_str.replace('L', '1')  # L:45 → 1:45
                        
                        is_pm = 'P' in t_str
                        is_am = 'A' in t_str
                        # Remove letters
                        t_str = re.sub(r'[A-Z]', '', t_str)
                        
                        h = 0
                        m = 0
                        if ':' in t_str:
                            parts = t_str.split(':')
                            h = int(parts[0])
                            m = int(parts[1])
                        elif len(t_str) >= 3:
                            # 3 or 4 digits: 930, 1030
                            m = int(t_str[-2:])
                            h = int(t_str[:-2])
                        else:
                            # 1 or 2 digits: 9, 10
                            h = int(t_str)
                            
                        # PM Logic
                        if is_pm and h != 12: h += 12
                        elif is_am and h == 12: h = 0
                        elif not is_pm and not is_am:
                            if h < 7: h += 12
                            
                        return time(hour=h, minute=m)

                    # Log time slots for debugging
                    with open("ocr_debug.log", "a") as f:
                        f.write(f"DEBUG: Row '{full_name}' Time Slots: {time_slots}\n")
                        f.write(f"DEBUG: Day Columns (X): {[(c[0], c[1]) for c in day_columns]}\n")

                    # Iterate columns to find shifts
                    row_shifts = []
                    
                    # Process each column to find shifts
                    for col_idx, (col_x, col_text) in enumerate(day_columns):
                        try:

                            # Determine day offset
                            day_lower = col_text.lower()
                            day_offset = 0
                            if "mon" in day_lower: day_offset = 0
                            elif "tue" in day_lower: day_offset = 1
                            elif "wed" in day_lower: day_offset = 2
                            elif "thu" in day_lower: day_offset = 3
                            elif "fri" in day_lower: day_offset = 4
                            elif "sat" in day_lower: day_offset = 5
                            elif "sun" in day_lower: day_offset = 6
                            
                            # Get time text for this column
                            time_text = time_slots.get(col_idx, "OFF") 
                            
                            # Skip if OFF

                            if "off" in time_text.lower():
                                continue
                                
                            # Check for location override in the text (Use raw text)
                            shift_location = current_location
                            text_upper_raw = time_text.upper()
                            
                            # Check mappings first
                            found_override = False
                            for key, val in LOCATION_MAPPINGS.items():
                                if key in text_upper_raw:
                                    shift_location = val
                                    found_override = True
                                    break
                            
                            if not found_override:
                                for loc in KNOWN_LOCATIONS:
                                    if loc in text_upper_raw:
                                        shift_location = loc.title()
                                        if loc == "CONRAC": shift_location = "Conrac"
                                        if loc == "PLAZA": shift_location = "Plaza"
                                        break

                            # Clean common OCR typos first
                            clean_time_text = time_text.upper()
                            
                            # Filter out known non-time text (Locations/OFF) - Expanded list
                            if any(x in clean_time_text for x in ['LOT', 'PLAZA', 'CONRAC', 'OFF', 'VACATION', '10T', 'P1AZA', 'P1A2A', 'C-LOT', 'E-LOT']):
                                continue

                            clean_time_text = clean_time_text.replace('O', '0').replace('Q', '0').replace('D', '0')
                            clean_time_text = clean_time_text.replace('I', '1').replace('L', '1').replace('!', '1').replace('|', '1')
                            clean_time_text = clean_time_text.replace('B', '8').replace('S', '5').replace('Z', '2') # Added Z->2
                            clean_time_text = clean_time_text.replace('_', ' ').replace('.', ':').replace(';', ':').replace(',', ':')
                            
                            # Fix missing hyphen if numbers are jammed (e.g. "6:00P2:00A")
                            clean_time_text = clean_time_text.replace('-', ' - ')
                            
                            # Regex pattern allowing flexible separators (colon, period, comma, semicolon, space, or none)
                            time_part_regex = r'(?:\d{1,2}[:.,;\s]?\d{0,2})\s*[APap][Mm]?'
                            range_pattern_regex = f'({time_part_regex}\\s*-\\s*{time_part_regex})'
                            
                            time_matches_in_slot = re.findall(range_pattern_regex, clean_time_text, re.IGNORECASE)
                            
                            with open("ocr_debug.log", "a") as f:
                                f.write(f"DEBUG: Col {col_idx} Original='{time_text}', Cleaned='{clean_time_text}', Matches={time_matches_in_slot}\n")

                            # Calculate base date for this week (Monday)
                            today = datetime.now()
                            start_of_week = today - timedelta(days=today.weekday())
                            
                            # Determine specific date for this shift
                            if col_idx in column_dates:
                                current_shift_date = column_dates[col_idx]
                            else:
                                current_shift_date = start_of_week + timedelta(days=day_offset)

                            if not time_matches_in_slot:
                                # Fallback: Store raw text if meaningful
                                if len(clean_time_text) > 3:
                                    # Create a dummy shift with raw text in notes
                                    s_dt = current_shift_date.replace(hour=9, minute=0, second=0, microsecond=0)
                                    e_dt = current_shift_date.replace(hour=17, minute=0, second=0, microsecond=0)
                                    
                                    row_shifts.append({
                                        "start_time": s_dt,
                                        "end_time": e_dt,
                                        "location": shift_location,
                                        "notes": f"RAW: {clean_time_text}" # Flag for frontend
                                    })
                                    with open("ocr_debug.log", "a") as f:
                                        f.write(f"DEBUG: Appended Fallback Shift for Col {col_idx}\n")
                                continue 
                            
                            match_str = time_matches_in_slot[0] 
                            
                            # Parse Time Range - Strip spaces around dash first
                            match_str = match_str.replace(' - ', '-').replace('- ', '-').replace(' -', '-')
                            # Replace period/comma/semicolon with colon (but NOT spaces)
                            match_str = re.sub(r'[.,;]', ':', match_str)
                            t_parts = match_str.split('-')
                            if len(t_parts) != 2: continue
                            
                            t_start_str, t_end_str = t_parts
                            
                            try:
                                s_time = parse_ocr_time(t_start_str)
                                e_time = parse_ocr_time(t_end_str)
                                
                                # Handle overnight shifts (end < start)
                                # Note: e_time is a time object, we track overnight by comparing times
                                # If end < start, we already added 1 day above, so end_dt calculation below handles it
                                if e_time < s_time:
                                    # Overnight shift detected - end_dt needs to be next day
                                    end_dt = current_shift_date.replace(hour=e_time.hour, minute=e_time.minute, second=0, microsecond=0) + timedelta(days=1)
                                else:
                                    end_dt = current_shift_date.replace(hour=e_time.hour, minute=e_time.minute, second=0, microsecond=0)
                                    
                                start_dt = current_shift_date.replace(hour=s_time.hour, minute=s_time.minute, second=0, microsecond=0)


                                # Store shift data
                                row_shifts.append({
                                    "start_time": start_dt,
                                    "end_time": end_dt,
                                    "location": shift_location
                                })

                            except Exception as e:
                                with open("ocr_debug.log", "a") as f:
                                    f.write(f"DEBUG: Time parse ERROR for '{t_start_str}' / '{t_end_str}': {e}\n")
                                print(f"Time parse error: {e}")
                                # Fallback on error too
                                s_dt = current_shift_date.replace(hour=9, minute=0, second=0, microsecond=0)
                                e_dt = current_shift_date.replace(hour=17, minute=0, second=0, microsecond=0)
                                row_shifts.append({
                                    "start_time": s_dt,
                                    "end_time": e_dt,
                                    "location": shift_location,
                                    "notes": f"RAW: {clean_time_text} (No match)"
                                })
                                continue
                        except Exception as loop_e:
                            print(f"CRITICAL ERROR processing column {col_idx}: {loop_e}")
                            traceback.print_exc()
                            continue

                    with open("ocr_debug.log", "a") as f:
                        f.write(f"DEBUG: Loop finished for row '{full_name}'. Row Shifts: {len(row_shifts)}\n")

                    print(f"DEBUG: Checking employee: {employee}")
                    if employee:
                        try:
                            # Save shifts
                            print(f"DEBUG: Saving {len(row_shifts)} shifts for {employee.first_name}")
                            for s_data in row_shifts:
                                # Create Shift object
                                shift = Shift(
                                    employee_id=employee.id,
                                    role_id=employee.default_role_id,
                                    start_time=s_data["start_time"],
                                    end_time=s_data["end_time"],
                                    location=s_data["location"],
                                    notes=s_data.get("notes")
                                )
                                if dry_run:
                                    parsed_shifts.append({
                                        "employee_id": employee.id,
                                        "employee_name": f"{employee.first_name} {employee.last_name}",
                                        "role_id": employee.default_role_id,
                                        "start_time": s_data['start_time'].isoformat(),
                                        "end_time": s_data['end_time'].isoformat(),
                                        "notes": s_data.get("notes", "OCR Import"),
                                        "location": s_data['location'],
                                        "is_vacation": False
                                    })
                                else:
                                    session.add(shift)
                                imported_count += 1
                                
                                # Log for debug
                                with open("ocr_debug.log", "a") as f:
                                    f.write(f"DEBUG: Created Shift for {employee.first_name}: {s_data['start_time']} - {s_data['end_time']} ({s_data['location']})\n")
                        except Exception as save_e:
                            print(f"Error saving shifts for {employee.first_name}: {save_e}")
                            traceback.print_exc()
                            with open("ocr_debug.log", "a") as f:
                                f.write(f"CRITICAL ERROR saving shifts for {employee.first_name}: {save_e}\n")
                    else:
                        # Employee not found - store name AND shifts
                        unmatched_employees.append({
                            "name": full_name,
                            "shifts": [
                                {
                                    "start_time": s['start_time'].isoformat(),
                                    "end_time": s['end_time'].isoformat(),
                                    "location": s['location']
                                } for s in row_shifts
                            ]
                        })
                        
                else:
                    unmatched_lines.append(full_line_text)

            # --- Memory Cleanup per Page ---
            del img
            del img_np
            if 'rotated_img' in locals(): del rotated_img
            if 'img_np_rot' in locals(): del img_np_rot
            if 'curr_results' in locals(): del curr_results
            if 'results' in locals(): del results
            gc.collect()

            
        if not dry_run:
            try:
                session.commit()
            except Exception as e:
                return {"message": "Database error", "errors": [str(e)]}
    
        return {
            "message": f"OCR Processing Complete. Found {imported_count} shifts.",
            "errors": errors,
            "raw_text_preview": extracted_text[:500] + "...", # This will be empty if direct PDF text failed
            "parsed_shifts": parsed_shifts,
            "unmatched_lines": unmatched_lines,
            "unmatched_employees": unmatched_employees  # Already deduplicated by only adding once per name
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"message": "OCR Failed", "errors": [str(e)]}

@app.post("/shifts/bulk/")
def create_shifts_bulk(shifts: List[dict], session: Session = Depends(get_session)):
    count = 0
    for s_data in shifts:
        try:
            # Parse dates
            start = datetime.fromisoformat(s_data['start_time'])
            end = datetime.fromisoformat(s_data['end_time'])
            
            shift = Shift(
                employee_id=s_data['employee_id'],
                role_id=s_data['role_id'],
                start_time=start,
                end_time=end,
                notes=s_data.get('notes'),
                location=s_data.get('location'), # Added location
                is_vacation=s_data.get('is_vacation', False)
            )
            session.add(shift)
            count += 1
        except Exception as e:
            print(f"Error creating shift: {e}")
            continue
            
    try:
        session.commit()
    except Exception as e:
        session.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Database Commit Failed: {str(e)}")
        
    print(f"DEBUG: Bulk create processed {count} shifts.")
    return {"message": f"Created {count} shifts"}

print("SERVER RESTART: Loaded main.py with Z->2 fix and improved filtering (v2)")
