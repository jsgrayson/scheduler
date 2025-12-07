from typing import Optional, List
from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship

class EmployeeRole(SQLModel, table=True):
    employee_id: Optional[int] = Field(default=None, foreign_key="employee.id", primary_key=True)
    role_id: Optional[int] = Field(default=None, foreign_key="role.id", primary_key=True)

class Role(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    color_hex: str
    
    employees: List["Employee"] = Relationship(back_populates="role") # One-to-Many (Primary)
    employee_links: List["Employee"] = Relationship(back_populates="roles", link_model=EmployeeRole) # Many-to-Many
    shifts: List["Shift"] = Relationship(back_populates="role")

class EmployeeBase(SQLModel):
    first_name: str
    last_name: str
    default_role_id: Optional[int] = Field(default=None, foreign_key="role.id")
    email: Optional[str] = None
    phone: Optional[str] = None
    max_weekly_hours: Optional[float] = Field(default=40.0, description="Maximum hours allowed per week")
    is_full_time: bool = Field(default=False, description="True=Full Time, False=Part Time")
    willing_to_work_vacation_week: bool = Field(default=True, description="True=Willing to work during vacation weeks")
    hire_date: Optional[datetime] = Field(default=None, description="Date of hire")
    last_call_time: Optional[datetime] = Field(default=None, description="Timestamp of last call for rotation")
    notes: Optional[str] = Field(default=None, description="Availability notes")

class Employee(EmployeeBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    
    role: Optional[Role] = Relationship(back_populates="employees") # Primary Role
    roles: List[Role] = Relationship(back_populates="employee_links", link_model=EmployeeRole) # All Roles
    shifts: List["Shift"] = Relationship(back_populates="employee")
    availabilities: List["Availability"] = Relationship(back_populates="employee")

class Availability(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    employee_id: int = Field(foreign_key="employee.id")
    day_of_week: int = Field(description="0=Monday, 6=Sunday")
    start_time: str = Field(description="HH:MM format")
    end_time: str = Field(description="HH:MM format")
    is_available: bool = Field(default=True, description="True=Available, False=Unavailable")
    
    employee: Employee = Relationship(back_populates="availabilities")

class Shift(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    employee_id: Optional[int] = Field(default=None, foreign_key="employee.id")
    role_id: int = Field(foreign_key="role.id")
    start_time: datetime
    end_time: datetime
    notes: Optional[str] = None
    location: Optional[str] = None # For lots/sections
    booth_number: Optional[str] = None # For Plaza booth assignments
    parent_id: Optional[int] = Field(default=None) # For recurrence grouping
    is_repeating: bool = Field(default=False) # For UI recurrence toggle
    is_vacation: bool = Field(default=False)
    is_locked: bool = Field(default=False, description="Locked shifts cannot be edited or deleted")
    
    employee: Optional[Employee] = Relationship(back_populates="shifts")
    role: Optional[Role] = Relationship(back_populates="shifts")

class RotationState(SQLModel, table=True):
    context_key: str = Field(primary_key=True, description="Key for rotation context (e.g. 'cashier_ft', 'maint_ft')")
    last_employee_id: int
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ShiftTemplate(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    employee_id: Optional[int] = Field(default=None, foreign_key="employee.id")
    role_id: int = Field(foreign_key="role.id")
    day_of_week: int = Field(description="0=Monday, 6=Sunday")
    start_time: str = Field(description="HH:MM format") # Use string for time to keep it simple across weeks
    end_time: str = Field(description="HH:MM format")
    location: Optional[str] = None
    booth_number: Optional[str] = None
    
    employee: Optional[Employee] = Relationship()
    role: Optional[Role] = Relationship()
