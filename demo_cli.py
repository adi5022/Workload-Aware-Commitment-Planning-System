"""
Interactive Terminal Demo for CommitWell Prototype
Run directly with python demo_cli.py
"""
import sys
from datetime import datetime, timedelta, timezone
from sqlmodel import SQLModel, Session, create_engine, select
from backend.models import Branch, TaskCommitment, FocusSession, AvailabilitySetting, SessionStatus

engine = create_engine("sqlite:///demo_workload.db", echo=False)

def get_utc_now():
    return datetime.now(timezone.utc)

def setup_db():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        # Default availability: 24h continuous capacity (00:00 - 23:59), all 7 days active
        existing = session.exec(select(AvailabilitySetting)).all()
        if not existing:
            for day in range(7):
                session.add(AvailabilitySetting(
                    weekday=day,
                    start_time_str="00:00",
                    end_time_str="23:59",
                    max_daily_hours=24.0,
                    is_active=True
                ))
            session.commit()

def calculate_available_capacity(days_ahead: int) -> float:
    with Session(engine) as session:
        rules = {r.weekday: r for r in session.exec(select(AvailabilitySetting)).all()}
    
    total = 0.0
    now = get_utc_now()
    for d in range(days_ahead):
        dt = now + timedelta(days=d)
        rule = rules.get(dt.weekday())
        if rule and rule.is_active:
            total += rule.max_daily_hours
    return total

def print_header(title: str):
    print("\n" + "=" * 65)
    print(f"  {title.upper()}")
    print("=" * 65)

def list_tasks():
    with Session(engine) as session:
        tasks = session.exec(select(TaskCommitment)).all()
        branches = {b.name: b for b in session.exec(select(Branch)).all()}
        
        print_header("Current Tasks & Branches")
        if not tasks:
            print("  (No tasks currently in the system)")
            return

        print(f"  {'ID':<3} | {'Task Name':<20} | {'Branch':<14} | {'Focus Needed':<12} | {'Remaining':<10} | {'Deadline'}")
        print("  " + "-" * 75)
        for t in tasks:
            b_info = branches.get(t.branch_name)
            p_score = f"{b_info.priority_score:.1f}" if b_info else "1.0"
            dl_str = t.deadline_date.strftime("%Y-%m-%d")
            status = "[DONE]" if t.is_completed else f"{t.remaining_focus_hours:.1f}h"
            print(f"  {t.id:<3} | {t.task_name:<20} | {t.branch_name} (p:{p_score}) | {t.focus_hours_needed:>4.1f}h        | {status:<10} | in {t.deadline_days}d ({dl_str})")

def add_task_flow():
    print_header("Add New Task")
    task_name = input("  Enter task name: ").strip()
    if not task_name:
        print("  [!] Task name cannot be empty.")
        return

    branch_name = input("  Enter branch (e.g. ML, Thesis, Client): ").strip()
    if not branch_name:
        branch_name = "General"

    try:
        focus_hours = float(input("  Enter focus hours needed: ").strip())
        if focus_hours <= 0:
            print("  [!] Focus hours must be > 0.")
            return
    except ValueError:
        print("  [!] Invalid number.")
        return

    try:
        deadline_days = int(input("  Enter deadline (number of days): ").strip())
        if deadline_days <= 0:
            print("  [!] Deadline days must be > 0.")
            return
    except ValueError:
        print("  [!] Invalid days.")
        return

    # Enforce Hard Invariant: focus_hours <= available working capacity before deadline
    available_cap = calculate_available_capacity(deadline_days)
    print(f"\n  Checking capacity: Over {deadline_days} days, you have {available_cap:.1f}h available working capacity.")

    if focus_hours > available_cap:
        print(f"  [X] INFEASIBLE: Requested {focus_hours:.1f} focus hours exceeds total capacity ({available_cap:.1f}h) before deadline!")
        proceed = input("  Do you still want to force record this commitment? (y/N): ").strip().lower()
        if proceed != 'y':
            print("  [i] Task rejected to preserve realistic workload.")
            return
    else:
        print(f"  [OK] Feasible! Workload pressure: {focus_hours/available_cap:.2f}")

    with Session(engine) as session:
        # Check / create Branch with default priority 1.0
        branch = session.exec(select(Branch).where(Branch.name == branch_name)).first()
        if not branch:
            branch = Branch(name=branch_name, priority_score=1.0)
            session.add(branch)
            session.commit()
            print(f"  [+] New official branch '{branch_name}' registered with initial priority 1.0.")

        now = get_utc_now()
        deadline_dt = now + timedelta(days=deadline_days)
        new_task = TaskCommitment(
            task_name=task_name,
            branch_name=branch_name,
            focus_hours_needed=focus_hours,
            remaining_focus_hours=focus_hours,
            deadline_days=deadline_days,
            deadline_date=deadline_dt,
            progress=0.0
        )
        session.add(new_task)
        session.commit()
        session.refresh(new_task)
        print(f"  [SUCCESS] Task #{new_task.id} '{task_name}' saved.")

def enter_focus_mode_flow():
    print_header("Enter Focus Mode")
    with Session(engine) as session:
        tasks = session.exec(select(TaskCommitment).where(TaskCommitment.is_completed == False)).all()
        if not tasks:
            print("  No active tasks with remaining focus hours!")
            return

        print("  Select a task to focus on:")
        for t in tasks:
            print(f"    [{t.id}] {t.task_name} ({t.remaining_focus_hours:.1f}h remaining / {t.focus_hours_needed:.1f}h total)")

        try:
            choice = int(input("\n  Enter Task ID: ").strip())
        except ValueError:
            print("  [!] Invalid ID.")
            return

        task = session.get(TaskCommitment, choice)
        if not task or task.is_completed:
            print("  [!] Task not found or already completed.")
            return

        try:
            focused_hours = float(input(f"  How many hours did you focus? (Remaining: {task.remaining_focus_hours:.1f}h): ").strip())
            if focused_hours <= 0:
                print("  [!] Hours must be positive.")
                return
        except ValueError:
            print("  [!] Invalid number.")
            return

        # COUNTDOWN RULE
        actual_deducted = min(task.remaining_focus_hours, focused_hours)
        task.remaining_focus_hours = max(0.0, task.remaining_focus_hours - actual_deducted)
        task.progress = round(((task.focus_hours_needed - task.remaining_focus_hours) / task.focus_hours_needed) * 100.0, 1)
        if task.remaining_focus_hours <= 0.01:
            task.is_completed = True

        # RECORD SESSION
        now = get_utc_now()
        sess = FocusSession(
            task_id=task.id,
            start_time=now - timedelta(hours=focused_hours),
            end_time=now,
            planned_hours=focused_hours,
            actual_hours_focused=focused_hours,
            status=SessionStatus.COMPLETED
        )
        session.add(sess)

        # UPDATE LEARNED BRANCH PRIORITY
        branch = session.exec(select(Branch).where(Branch.name == task.branch_name)).first()
        if branch:
            branch.total_completed_hours += actual_deducted
            if task.is_completed:
                branch.total_tasks_completed += 1
            # Learning adaptation: higher completed volume elevates branch priority parameter
            branch.priority_score = round(1.0 + (branch.total_completed_hours * 0.1), 2)
            session.add(branch)

        session.add(task)
        session.commit()

        print("\n  ================== FOCUS SUMMARY ==================")
        print(f"  Task:                {task.task_name}")
        print(f"  Focus Hours Logged:  {focused_hours:.1f} h")
        print(f"  Remaining to Do:     {task.remaining_focus_hours:.1f} h")
        print(f"  Progress:            {task.progress}% {'[COMPLETED!]' if task.is_completed else ''}")
        if branch:
            print(f"  Branch '{branch.name}' Learned Priority: {branch.priority_score:.2f} (updated from workflow)")
        print("  ===================================================\n")

def main():
    setup_db()
    while True:
        print_header("CommitWell Engine - Terminal Visualizer")
        print("  1. List All Tasks & Branch Priorities")
        print("  2. Add New Task (with Focus Hours & Capacity Check)")
        print("  3. Enter Focus Mode (Count down remaining hours)")
        print("  4. Exit")
        choice = input("\n  Choose an option (1-4): ").strip()

        if choice == '1':
            list_tasks()
        elif choice == '2':
            add_task_flow()
        elif choice == '3':
            enter_focus_mode_flow()
        elif choice == '4':
            print("\n  Goodbye!\n")
            sys.exit(0)
        else:
            print("  [!] Invalid option.")

if __name__ == "__main__":
    main()

