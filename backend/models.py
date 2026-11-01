from datetime import datetime, timezone
from typing import Optional
from enum import Enum
from sqlmodel import SQLModel, Field

def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)

class SessionStatus(str, Enum):
    PROPOSED = "proposed"
    APPROVED = "approved"
    COMPLETED = "completed"
    MISSED = "missed"
    CANCELLED = "cancelled"

class ProposalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUPERSEDED = "superseded"

# 1. User-Defined Branch Registry with Learned Priority Parameter
class Branch(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)
    priority_score: float = Field(default=1.0)  # Equal starting priority for any branch; learned over time
    total_completed_hours: float = Field(default=0.0)
    total_tasks_completed: int = Field(default=0)
    created_at: datetime = Field(default_factory=get_utc_now)
    updated_at: datetime = Field(default_factory=get_utc_now)

# 2. Task (Commitment) Model
class TaskCommitment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    task_name: str = Field(index=True)
    branch_name: str = Field(index=True)  # User-defined branch
    
    # Focus hours & deadline rules
    focus_hours_needed: float  # User-entered focus hours (can be any value)
    remaining_focus_hours: float  # Strictly counts down on completed focus sessions
    deadline_days: int  # Deadline in terms of days
    deadline_date: datetime  # Exact calculated deadline datetime
    
    progress: float = Field(default=0.0)  # Percentage 0-100%
    is_completed: bool = Field(default=False)
    created_at: datetime = Field(default_factory=get_utc_now)
    updated_at: datetime = Field(default_factory=get_utc_now)

# 3. Focus Session (For the countdown & calendar)
class FocusSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: int = Field(foreign_key="taskcommitment.id", index=True)
    proposal_id: Optional[int] = Field(default=None, index=True)
    
    start_time: datetime
    end_time: datetime
    planned_hours: float
    actual_hours_focused: Optional[float] = None
    status: SessionStatus = Field(default=SessionStatus.PROPOSED)
    created_at: datetime = Field(default_factory=get_utc_now)
    updated_at: datetime = Field(default_factory=get_utc_now)

# 4. User Availability & Daily Schedule Capacity (24h continuous capacity for human + agents)
class AvailabilitySetting(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    weekday: int = Field(description="0=Monday, 6=Sunday")
    start_time_str: str = "00:00"
    end_time_str: str = "23:59"
    max_daily_hours: float = 24.0  # 24h daily capacity
    is_active: bool = True

# 5. Schedule Proposal
class ScheduleProposal(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    status: ProposalStatus = Field(default=ProposalStatus.PENDING)
    warnings_json: str = "[]"
    infeasibility_details_json: str = "{}"
    summary_json: str = "{}"
    created_at: datetime = Field(default_factory=get_utc_now)

