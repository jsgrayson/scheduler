from typing import Optional, List
from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship

class Role(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    color_hex: str
    
    employees: List["Employee"] = Relationship(back_populates="role")
    shifts: List["Shift"] = Relationship(back_populates="role")

class Employee(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    first_name: str
    last_name: str
    default_role_id: Optional[int] = Field(default=None, foreign_key="role.id")
    email: Optional[str] = None
    phone: Optional[str] = None
    max_weekly_hours: Optional[float] = Field(default=40.0, description="Maximum hours allowed per week")
    is_full_time: bool = Field(default=False, description="True=Full Time, False=Part Time")
    last_call_time: Optional[datetime] = Field(default=None, description="Timestamp of last call for rotation")
    
    role: Optional[Role] = Relationship(back_populates="employees")
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
    
    employee: Optional[Employee] = Relationship(back_populates="shifts")
    role: Role = Relationship(back_populates="shifts")
