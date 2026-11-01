# CLAUDE.md --- Workload-Aware Commitment Planner

## Project mission

Build a usable workload-aware commitment planning application for people
managing multiple projects, assignments, work responsibilities, and
personal commitments.

This is **not a generic to-do list or chatbot**. The product must
estimate effort, calculate workload capacity, propose feasible schedules
across multiple commitments, detect conflicts, and help users recover
when plans slip.

The core product principle:

> Help users honour their commitments by making their workload
> realistically manageable. Never hide infeasibility, silently discard
> unfinished work, or pretend an impossible schedule is achievable.

## Primary engineering objective

Deliver a working, demonstrable MVP within a four-hour build window.

Prioritize end-to-end correctness over feature count or visual polish. A
smaller working vertical slice is better than a broad collection of
non-functional screens.

## Product decisions

-   **Audience:** Anyone managing multiple commitments.
-   **Effort estimation:** AI estimates effort; users can review and
    correct estimates. The system should learn from actual completion
    times as data accumulates.
-   **Scheduling:** The system automatically proposes schedules. Users
    approve proposals before they become active.
-   **AI boundary:** AI interprets natural language and estimates
    effort. Deterministic application logic is responsible for capacity
    calculations, conflict detection, schedule validation, and
    allocation.

## Preferred stack

-   Frontend: React + TypeScript
-   Styling: Tailwind CSS
-   Backend: Python + FastAPI
-   Persistence: SQLite for the MVP
-   AI: configurable LLM provider through a backend service; never
    expose API keys to the frontend
-   Calendar: a suitable React calendar component, or a custom week view
    if faster and reliable
-   Charts: Recharts where useful
-   Background reminders: APScheduler or another simple backend
    scheduler
-   Tests: pytest for backend logic; add frontend tests only if time
    permits

Do not introduce additional infrastructure unless it materially improves
the MVP. Avoid microservices, distributed queues, authentication
complexity, and premature abstractions.

## Core domain model

Implement clear, validated models for at least:

### Commitment

-   id
-   title
-   description
-   category
-   deadline
-   priority
-   estimated_effort_hours
-   minimum_effort_hours (optional)
-   maximum_effort_hours (optional)
-   remaining_effort_hours
-   progress
-   status
-   created_at
-   updated_at

### Availability

-   weekday or date
-   available start/end times or available hours
-   unavailable periods where supported
-   timezone

### Work session

-   id
-   commitment_id
-   start
-   end
-   planned_effort_hours
-   actual_effort_hours (optional)
-   status: proposed, approved, completed, missed, cancelled

### Dependency

-   predecessor_commitment_id
-   dependent_commitment_id
-   relationship or ordering constraint

### Estimation record

-   commitment_id
-   original_ai_estimate
-   user_adjusted_estimate
-   actual_effort
-   category
-   recorded_at

### Schedule proposal

-   id
-   created_at
-   status: pending, approved, rejected, superseded
-   proposed sessions
-   warnings and infeasibility details

Persist data. Do not rely on in-memory state for core functionality.

## Required user workflows

### 1. Create a commitment

A user can enter a title, description, deadline, category, and priority.
The AI may extract structured details and estimate effort from the
description.

Return structured data, not free-form prose alone. Include: - estimated
hours - minimum / likely / maximum estimate when available -
assumptions - suggested subtasks - possible dependencies - confidence or
uncertainty indicator

If the AI provider is unavailable, the user must still be able to create
a commitment and enter effort manually.

### 2. Review and correct estimates

AI estimates are suggestions. Users must be able to edit them before
scheduling. Preserve the original estimate and user-adjusted estimate
separately.

### 3. Configure availability

Users specify working days, available hours, unavailable periods, and
maximum daily workload. Do not assume every calendar day is fully
available.

### 4. Generate a schedule

The scheduler distributes work across multiple commitments. It must: -
respect deadlines - respect user availability - respect daily capacity -
avoid overlapping sessions - respect dependencies - respect maximum
session duration where configured - account for remaining effort -
report all unallocated effort - expose infeasible commitments rather
than hiding them

Split divisible work into manageable sessions. Support a configurable
maximum session length. Do not force a user to work on only one
commitment for an entire day when a mixed schedule is feasible.

### 5. Review and approve

A generated schedule is a **proposal**. Show proposed sessions and
warnings. The user can approve, reject, or request recalculation. Do not
overwrite an approved schedule until the user approves its replacement.

### 6. Record progress and actual effort

Users can mark sessions completed, missed, or partially completed and
record actual time spent. Preserve the difference between elapsed
calendar time and active working time.

### 7. Recover from missed work

When a session is missed: 1. Preserve the unfinished effort. 2.
Recalculate remaining capacity. 3. Identify affected commitments. 4.
Generate a revised proposal. 5. Explain the trade-offs and risks. 6.
Require approval before applying the new schedule.

Never silently move work beyond its deadline or delete unfinished work.

### 8. Reminders

At minimum, implement one honest, functioning reminder mechanism. In-app
reminders are acceptable for the MVP. Email or Web Push is a stretch
feature and must only be shown as enabled if delivery is actually
configured and tested.

Reminder jobs must be idempotent. Avoid sending duplicate notifications.
Respect timezone and quiet-hour settings if implemented.

## Scheduling engine requirements

The scheduler is the most important correctness-sensitive component.
Keep it deterministic and independently testable.

### Inputs

-   active commitments
-   remaining effort per commitment
-   deadlines
-   user priorities
-   dependencies
-   availability calendar
-   maximum daily capacity
-   preferred/minimum/maximum session durations
-   existing fixed commitments
-   buffer preference

### Initial approach

Implement a transparent heuristic or constraint-based scheduler. A
suitable sequence:

1.  Generate valid available time slots.
2.  Remove unavailable periods and fixed events.
3.  Validate dependencies and detect cycles.
4.  Calculate urgency and workload pressure.
5.  Allocate sessions while respecting deadlines and capacity.
6.  Split work into valid sessions.
7.  Validate the entire proposed schedule.
8.  Report unallocated effort, deadline risks, and capacity deficits.

An urgency/pressure score may be used to order candidate work, but it is
not a substitute for validating the final schedule.

If using OR-Tools CP-SAT, keep the model small and explain the
objective. Do not add a solver dependency if a simpler deterministic
algorithm can satisfy the MVP reliably.

### Non-negotiable invariants

-   No overlapping sessions.
-   No work outside user availability.
-   No daily capacity violations.
-   No sessions after the commitment deadline.
-   No dependent task scheduled before its prerequisite is complete,
    where dependency semantics require ordering.
-   No completed task receives new sessions.
-   All remaining effort is either scheduled or explicitly reported as
    unscheduled.
-   An infeasible schedule must be reported as infeasible.

Do not use an arbitrary priority score to claim feasibility. Validate
the generated schedule against the actual constraints.

### Workload pressure

A simple initial measure is:

`pressure = remaining_effort_hours / available_working_hours_before_deadline`

Treat values above 1 as infeasible under the current capacity
assumptions. Values approaching 1 indicate little or no buffer. Explain
that thresholds are configurable heuristics, not scientific measures of
productivity.

## Learning from actual completion times

Do not claim the system has trained a predictive model when it has only
a handful of observations.

For the MVP: - Store original AI estimates, user corrections, and actual
active effort separately. - Start with category-level calibration or a
conservative weighted error adjustment. - Require a minimum number of
observations before applying strong personalization. - Avoid allowing
one unusual task to distort all future estimates. - Show when historical
data influenced an estimate. - Never overwrite historical records.

A later version can use robust regression or another personalized
estimator once enough data exists.

## AI assistant rules

The assistant can: - parse natural-language commitments - extract dates,
effort clues, and dependencies - estimate effort with explicit
assumptions - answer questions about current workload - explain schedule
conflicts - request a rescheduling proposal - explain the impact of
postponement

The assistant must not: - invent deadlines or completion records - claim
a schedule is feasible without scheduler validation - directly mutate
approved schedules without user approval - silently discard work -
pretend email or push notifications were sent - present uncertain effort
estimates as facts

Use structured outputs and validate them with Pydantic models. Keep
provider-specific API code behind a service interface.

## Frontend expectations

Build a coherent, responsive application with a practical information
hierarchy.

Essential screens or views: - Dashboard: today's work, upcoming
deadlines, workload pressure, and warnings - Commitments: list and
create/edit flows - Schedule: calendar or timeline showing sessions
across commitments - Proposal review: proposed changes, warnings, and
approve/reject actions - Progress: completed, missed, and remaining
effort - Settings: availability, daily capacity, session length,
timezone, reminders

The interface should make conflicts and unscheduled work obvious. Do not
prioritize decorative animations over usability.

## API and implementation quality

-   Use typed request and response schemas.
-   Validate inputs at API boundaries.
-   Keep scheduling logic separate from route handlers.
-   Keep AI-provider integration separate from business logic.
-   Handle missing API credentials gracefully.
-   Return useful error messages.
-   Use timezone-aware datetimes consistently.
-   Add database migrations or a simple safe schema initialization
    strategy.
-   Include a `.env.example`; never commit secrets.
-   Provide seed/demo data so the application can be evaluated quickly.

## Minimum automated tests

At minimum, test: 1. Three or more commitments can be stored and
retrieved. 2. A schedule respects daily capacity. 3. Sessions do not
overlap. 4. Sessions fit within availability. 5. A deadline conflict is
reported. 6. Insufficient total capacity is reported as infeasible. 7.
Dependencies are respected. 8. Missed work remains in remaining effort.
9. A new schedule proposal does not overwrite an approved schedule
before approval. 10. Duplicate reminder generation is prevented, if
reminders are implemented.

Include at least one deterministic benchmark scenario with multiple
commitments and known available capacity.

## Four-hour build priorities

Suggested time budget:

-   0:00--0:25 --- inspect environment, plan architecture, scaffold
    project
-   0:25--1:00 --- models, persistence, commitment APIs
-   1:00--1:35 --- effort estimation and manual fallback
-   1:35--2:25 --- workload calculations and scheduler
-   2:25--3:05 --- React dashboard and schedule view
-   3:05--3:35 --- proposal approval, progress, and rescheduling
-   3:35--3:50 --- one functioning reminder mechanism
-   3:50--4:00 --- tests, fixes, and delivery

This is a prioritization guide, not a reason to skip correctness. If
time is running out, reduce scope rather than fake functionality.

### Priority order

1.  Persistent commitments
2.  Availability and capacity model
3.  Correct deterministic scheduler
4.  Schedule proposal and approval
5.  Progress and missed-session recovery
6.  AI effort estimation
7.  Frontend usability
8.  Reminders
9.  Historical calibration

If the AI provider is unavailable, manual estimates must keep the
product usable.

## Coding-agent working protocol

Before coding: 1. Inspect the existing repository and runtime. 2.
Identify existing conventions and dependencies. 3. Produce a short
implementation plan. 4. Identify the highest-risk technical component:
scheduling correctness. 5. Start the application early and keep it
runnable.

During implementation: - Build and verify vertical slices. - Run backend
tests after scheduler changes. - Run the frontend and exercise real
workflows. - Do not create placeholder buttons that imply working
features. - Do not replace real functionality with hardcoded demo
output. - Avoid unnecessary rewrites of working code. - Keep changes
focused and report blockers early.

Before delivery: 1. Start the backend and frontend from documented
commands. 2. Exercise the primary workflow end to end. 3. Run automated
tests. 4. Verify schedule invariants using the benchmark dataset. 5.
Check that data persists after restart. 6. Document setup, environment
variables, limitations, and known defects. 7. Report honestly what
works, what is incomplete, and what was tested.

## Definition of done

The MVP is done only when a user can: 1. Create multiple commitments. 2.
Receive an AI effort estimate or enter one manually. 3. Correct
estimates. 4. Configure available working hours. 5. Generate a schedule
distributed across commitments. 6. See capacity conflicts and
unscheduled work. 7. Review and approve a schedule proposal. 8. Record
completed or missed work. 9. Generate a revised proposal without losing
unfinished effort. 10. Use at least one genuinely functioning reminder
mechanism, or see a clearly labelled, non-functional reminder capability
omitted from the MVP.

A polished calendar with an incorrect scheduler is a failed
implementation. A modest interface with correct, tested scheduling and
recovery is a successful MVP.
