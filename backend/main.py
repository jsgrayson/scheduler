
from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime, timedelta
from database import create_db_and_tables, get_session
from models import Employee, Role, Shift, Availability
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

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

# --- Employees ---
@app.get("/employees/", response_model=List[Employee])
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

@app.put("/employees/{employee_id}", response_model=Employee)
def update_employee(employee_id: int, employee_data: EmployeeUpdate, session: Session = Depends(get_session)):
    employee = session.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    hero_data = employee_data.model_dump(exclude_unset=True)
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
    recommendations.sort(key=lambda x: x["score"], reverse=True)
    return recommendations

# --- Call Sheet Rotation ---
@app.get("/callsheet/rotation/")
def get_call_rotation(role_id: Optional[int] = None, session: Session = Depends(get_session)):
    """
    Returns employees sorted for call sheet rotation.
    Group 1: Full Time (Sorted by last_call_time ASC - oldest call first)
    Group 2: Part Time (Sorted by last_call_time ASC or name)
    """
    query = select(Employee)
    if role_id:
        query = query.where(Employee.default_role_id == role_id)
        
    employees = session.exec(query).all()
    
    full_time = [e for e in employees if e.is_full_time]
    part_time = [e for e in employees if not e.is_full_time]
    
    # Sort Full Time: Null last_call_time first (never called), then oldest date
    full_time.sort(key=lambda x: (x.last_call_time is not None, x.last_call_time))
    
    # Sort Part Time: Same logic or just by name? User said "last person called on the full time to start with next person rotating"
    # Implies rotation is critical for FT. For PT, maybe just alphabetical or same rotation?
    # Let's use same rotation logic for fairness.
    part_time.sort(key=lambda x: (x.last_call_time is not None, x.last_call_time))
    
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

@app.post("/import/ocr/")
async def import_ocr(file: UploadFile = File(...), session: Session = Depends(get_session)):
    contents = await file.read()
    
    # Convert PDF to image if needed
    images = []
    if file.filename.lower().endswith('.pdf'):
        images = convert_from_bytes(contents)
    else:
        images = [Image.open(io.BytesIO(contents))]
        
    extracted_text = ""
    for img in images:
        # Preprocess: Deskew
        try:
            img = deskew_image(img)
        except Exception as e:
            print(f"Deskew failed: {e}")
            # Continue with original image
            
        extracted_text += pytesseract.image_to_string(img) + "\n"
        
    # Parse Text
    # Heuristic: Look for "Mon", "Tue", etc. for header
    # Rows: Employee Name ... times
    
    lines = extracted_text.split('\n')
    header_found = False
    col_map = {} # index -> date (datetime)
    
    imported_count = 0
    errors = []
    
    # Find next Monday for default dating
    today = datetime.now()
    next_monday = today + timedelta(days=(7 - today.weekday()))
    current_week_start = next_monday # Default to next week if no dates found
    
    for line in lines:
        parts = line.split()
        if not parts:
            continue
            
        # 1. Identify Header
        if not header_found:
            # Check for day names
            days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
            matches = [d for d in parts if any(day in d.lower() for day in days)]
            if len(matches) >= 3: # At least 3 days found
                header_found = True
                # Map columns. This is hard because OCR loses spacing.
                # We'll assume the order is Mon, Tue, Wed... 
                # and try to align parts.
                # Simplified: Just assume standard week order starting from first match
                # This is very brittle. 
                # Better approach: Just look for lines starting with Employee Names after header
                continue
        
        # 2. Process Rows (if header found or just trying)
        # Try to match first part to Employee
        emp_name_candidate = parts[0]
        if len(parts) > 1 and parts[1][0].isalpha(): # Maybe "John Doe"
             emp_name_candidate += " " + parts[1]
             
        # Fuzzy match employee
        # Simple check: First name match
        employee = session.exec(select(Employee).where(Employee.first_name.ilike(parts[0]))).first()
        
        if employee:
            # We found an employee line!
            # Now try to find times.
            # We need to know which time corresponds to which day.
            # Without column mapping, this is impossible.
            # Let's assume the text is: "John 9-5 9-5 OFF 9-5 ..."
            # We'll just grab all time-like patterns and assign them to Mon-Sun sequentially.
            
            time_patterns = []
            for part in parts[1:]:
                # Check for "9-5", "09:00-17:00", "OFF"
                if "-" in part or "off" in part.lower():
                    time_patterns.append(part)
            
            # Assign to days starting from Monday
            current_day = current_week_start
            for i, tp in enumerate(time_patterns):
                if i >= 7: break
                
                if "off" in tp.lower():
                    current_day += timedelta(days=1)
                    continue
                    
                try:
                    # Parse "9-5" or "9:00-17:00"
                    t_start, t_end = tp.split('-')
                    
                    # Helper to parse time string
                    def parse_time_str(t_str):
                        t_str = t_str.strip()
                        if ":" in t_str:
                            return datetime.strptime(t_str, "%H:%M").time()
                        else:
                            # Assume hour, maybe am/pm? 
                            # If just number < 12, assume am/pm logic?
                            # Let's assume 24h or simple int
                            h = int(t_str)
                            if h < 7: h += 12 # PM adjustment guess
                            return time(hour=h, minute=0)

                    s_time = parse_time_str(t_start)
                    e_time = parse_time_str(t_end)
                    
                    start_dt = datetime.combine(current_day.date(), s_time)
                    end_dt = datetime.combine(current_day.date(), e_time)
                    
                    if end_dt <= start_dt:
                        end_dt += timedelta(days=1)
                        
                    # Create Shift
                    shift = Shift(
                        employee_id=employee.id,
                        role_id=employee.default_role_id,
                        start_time=start_dt,
                        end_time=end_dt,
                        notes="OCR Import"
                    )
                    session.add(shift)
                    imported_count += 1
                    
                except Exception as e:
                    # errors.append(f"Error parsing time '{tp}' for {employee.first_name}: {str(e)}")
                    pass
                
                current_day += timedelta(days=1)
                
    try:
        session.commit()
    except Exception as e:
        return {"message": "Database error", "errors": [str(e)]}

    return {
        "message": f"OCR Processing Complete. Imported {imported_count} shifts.",
        "errors": errors,
        "raw_text_preview": extracted_text[:500] + "..."
    }
