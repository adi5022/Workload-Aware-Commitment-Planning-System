# Workload-Aware Commitment Planning System
## Product Specification, Scheduling Architecture & Four-Hour Engineering Benchmark

**Product category:** Personal commitment and workload management  
**Primary audience:** Anyone managing multiple commitments  
**Frontend:** React + TypeScript  
**Backend:** FastAPI + Python  
**Database:** SQLite (MVP)  
**Development constraint:** Four hours  
**Product principle:** Help users fulfil their commitments by making their workload realistically manageable.

---

# 1. Product Overview

## 1.1 Problem Statement

People managing multiple projects, assignments, professional responsibilities and personal commitments frequently underestimate the amount of work involved.

Conventional task managers primarily track:
- What needs to be done.
- When it is due.
- Whether it has been completed.

They rarely account for:
- How much actual effort a commitment requires.
- Whether the user's existing workload can accommodate it.
- How multiple commitments compete for limited working hours.
- How postponing one task affects other commitments.
- Whether the original schedule remains achievable.

This creates a gap between maintaining a list of responsibilities and actually managing the workload required to fulfil them.

## 1.2 Proposed Solution

Build an intelligent commitment planning application that maintains an understanding of the user's responsibilities, estimates their required effort, distributes work across available time and continuously adapts the schedule as circumstances change.

The application should:

1. Accept projects, assignments and other commitments.
2. Understand descriptions and estimate required effort using AI.
3. Allow users to review and correct estimates.
4. Identify overlapping commitments and workload conflicts.
5. Generate feasible schedules across multiple commitments.
6. Monitor progress and actual completion times.
7. Learn from the user's historical estimation errors.
8. Proactively remind users when work should begin.
9. Recalculate schedules when work is delayed, completed or modified.
10. Require user approval before applying proposed schedule changes.

## 1.3 Product Philosophy

The application is not intended to help users avoid commitments or simply postpone deadlines.

Its purpose is to help users honour their commitments through realistic workload allocation.

The system must never silently discard unfinished work, conceal an overloaded schedule or present an infeasible plan as achievable.

---

# 2. Core Functional Requirements

## 2.1 Commitment Management

Users must be able to create and manage different types of commitments.

Supported commitment categories:

- Academic assignments.
- Personal projects.
- Professional projects.
- Research activities.
- Presentations.
- Examinations.
- Administrative responsibilities.
- Personal goals.

Each commitment should contain:

| Attribute | Description |
|---|---|
| Title | Commitment name |
| Description | Natural-language explanation |
| Category | Commitment type |
| Deadline | Required completion date and time |
| Estimated effort | Required working hours |
| Priority | User-defined importance |
| Dependencies | Tasks that must precede it |
| Progress | Completion percentage |
| Actual effort | Recorded working time |
| Status | Pending, active, completed or overdue |

Users should be able to modify all AI-generated information.

## 2.2 AI-Based Effort Estimation

When a user enters a commitment, the AI subsystem should analyse its description and estimate the required effort.

Example:

**Input:**

"Build a machine learning application that classifies plant diseases using a pretrained model, implement the backend and frontend, and prepare a demonstration."

**Expected structured output:**

| Component | Estimated hours |
|---|---:|
| Research and preparation | 2 |
| Dataset preparation | 3 |
| Model integration | 3 |
| Backend implementation | 3 |
| Frontend implementation | 4 |
| Testing and debugging | 3 |
| Total | 18 |

The estimation system should also return:

- Estimated minimum effort.
- Most likely effort.
- Estimated maximum effort.
- Assumptions.
- Identified subtasks.
- Potential dependencies.
- Confidence level.

Use a three-point estimate rather than pretending that a single AI-generated number is precise.

The initial estimate should be reviewed by the user before scheduling.

## 2.3 Adaptive Effort Estimation

The system should gradually learn how accurately it estimates work for individual users.

For every completed task, record:

- Original estimated effort.
- User-adjusted estimate.
- Actual recorded effort.
- Commitment category.
- Complexity.
- Task characteristics.

The estimation subsystem should use this information to calibrate future estimates.

For example:

| Metric | Value |
|---|---:|
| Initial AI estimate | 8 hours |
| User-adjusted estimate | 10 hours |
| Actual completion time | 12 hours |
| Estimation error | +2 hours against adjusted estimate |

The system should learn that similar tasks may require more time for this particular user.

Important: distinguish active working time from elapsed calendar time. A task that takes three calendar days may involve only five hours of actual work.

The first implementation can use category-specific calibration and weighted historical error correction. More sophisticated personalized prediction can be introduced once sufficient data exists.

---

# 3. Workload Intelligence Engine

This is the central decision-making subsystem.

The application must maintain a continuously updated representation of the user's workload.

## 3.1 Available Capacity

Users should configure:

- Available working hours per day.
- Preferred working periods.
- Working days.
- Unavailable periods.
- Maximum daily workload.
- Optional preferred session length.

The system should distinguish working capacity from total time remaining until a deadline.

For example, having six calendar days remaining does not mean six full working days are available.

## 3.2 Commitment Pressure

For each commitment, calculate:

- Remaining effort.
- Available working hours before its deadline.
- Required average daily effort.
- Deadline urgency.
- Dependency impact.
- Schedule buffer.

An illustrative pressure measure:

Pressure = Remaining effort / Available capacity before deadline

Interpretation:

- Below 0.6: Comfortable.
- 0.6–0.85: Manageable.
- 0.85–1.0: High pressure.
- Above 1.0: Infeasible under current constraints.

These are initial configurable thresholds, not universal measures of human productivity.

## 3.3 Conflict Detection

The system must identify more than identical deadlines.

Relevant conflicts include:

1. Multiple commitments competing for the same working hours.
2. Insufficient remaining capacity.
3. Dependencies that cannot be completed before dependent work begins.
4. Excessively concentrated workload.
5. Tasks without sufficient completion buffer.
6. New commitments that make existing schedules infeasible.

When a new commitment is introduced, the system must assess its impact on existing commitments.

Example:

- Project A: 12 hours remaining, due in five days.
- Assignment B: 8 hours remaining, due in four days.
- Project C: 10 hours remaining, due in seven days.
- User capacity: 4 hours per day.

Total effort: 30 hours.

Available capacity across seven days: 28 hours.

The system must identify the deficit rather than generate an apparently valid schedule that hides two hours of missing capacity.

---

# 4. Adaptive Scheduling Engine

## 4.1 Scheduling Objective

The scheduler must distribute work across multiple commitments while respecting available capacity and deadlines.

It should not allocate an entire uninterrupted period to one project simply because that project has the earliest deadline.

Work should be distributed according to urgency, remaining effort, dependencies, user priorities and available working periods.

## 4.2 Scheduling Inputs

The scheduling engine receives:

- Active commitments.
- Remaining effort per commitment.
- Deadlines.
- User priorities.
- Daily availability.
- Task dependencies.
- Minimum and maximum session durations.
- Existing fixed calendar events.
- Required buffer time.

## 4.3 Scheduling Constraints

A proposed schedule must satisfy:

1. No session may exceed available working capacity.
2. Sessions must not overlap.
3. Dependencies must be respected.
4. Work must not be scheduled after its deadline.
5. Completed tasks must not receive additional sessions.
6. Fixed unavailable periods must be respected.
7. Remaining effort must be accounted for.
8. Unscheduled work must be explicitly reported.

Tasks should be divisible into sessions where appropriate.

Some activities may require contiguous sessions. The user should be able to mark these as non-interruptible.

## 4.4 Scheduling Priority

An initial priority heuristic can combine:

- Deadline proximity.
- Remaining effort relative to available capacity.
- User-defined importance.
- Dependency criticality.
- Existing schedule pressure.

For example:

Priority(i) = w1 × Urgency(i) + w2 × Pressure(i) + w3 × Importance(i) + w4 × DependencyImpact(i)

Weights should be configurable and normalized.

This is a prioritization heuristic, not the complete scheduling algorithm.

## 4.5 Recommended Scheduling Approach

Use a deterministic scheduling algorithm.

A suitable initial implementation:

1. Construct available time slots.
2. Remove unavailable periods.
3. Identify dependency relationships.
4. Calculate the urgency and workload pressure of each commitment.
5. Generate candidate work sessions.
6. Allocate sessions using priority and deadline constraints.
7. Validate the complete schedule.
8. Identify unallocated effort.
9. Return the proposed schedule and explanations.

For a more advanced implementation, use constraint optimization with OR-Tools CP-SAT.

The objective should minimize a weighted combination of:

- Missed deadlines.
- Unscheduled work.
- Deadline lateness.
- Excessive workload concentration.
- Unnecessary fragmentation.
- Insufficient completion buffers.
- Deviations from user preferences.

The optimizer must never make an infeasible schedule appear feasible merely to maximize its objective score.

## 4.6 Schedule Approval

The application should automatically generate a proposed schedule but must obtain user approval before applying it.

The user should be able to:

- Accept the entire schedule.
- Modify individual sessions.
- Reject the proposal.
- Change available working hours.
- Adjust commitment estimates.
- Request a new schedule.

Once approved, the schedule becomes the active plan.

---

# 5. Proactive Reminder System

The application should use calculated work-start dates rather than relying exclusively on deadline notifications.

Example:

A commitment has:
- Deadline: October 7.
- Required effort: 18 hours.
- Available capacity: 3 hours per day.

The system determines when work must begin and schedules reminders accordingly.

## 5.1 Reminder Types

**Initial reminder**

Notify the user when a commitment should begin.

**Progress reminder**

Check whether scheduled work has been completed.

**Upcoming deadline reminder**

Notify the user when a deadline approaches.

**Overdue work reminder**

Identify unfinished work and calculate its impact on other commitments.

**Schedule intervention**

Notify the user when changes make the current schedule infeasible.

## 5.2 Notification Channels

MVP:
- In-app notifications.
- Browser notifications.

Additional channels:
- Email.
- Web Push.
- Mobile push notifications.
- Calendar integrations.

Email and push notifications should be sent by a persistent backend process, not by an open browser tab.

Notifications must be idempotent to prevent repeated delivery of the same reminder.

Users must be able to configure reminder frequency and quiet hours.

---

# 6. Progress Monitoring and Commitment Debt

## 6.1 Progress Tracking

Users should be able to:

- Start a work session.
- Pause a session.
- Complete a session.
- Update task progress.
- Record actual time spent.
- Mark work as completed.

The system should compare planned effort with actual effort.

## 6.2 Missed Work Handling

If the user misses a scheduled session:

1. Mark the session as missed or incomplete.
2. Preserve its remaining effort.
3. Recalculate available capacity.
4. Identify affected commitments.
5. Generate a revised schedule.
6. Explain any increased deadline risk.
7. Request approval before applying changes.

## 6.3 Commitment Debt

Introduce an internal concept called commitment debt.

Commitment debt represents work carried forward from missed or postponed sessions that now competes with future available capacity.

It should account for:

- Deferred working hours.
- Lost schedule buffers.
- Increased workload pressure.
- Dependencies affected by the delay.

It should not be presented as a psychological diagnosis or a moral judgment.

The purpose is to make the consequences of postponement visible.

---

# 7. AI Assistant Behaviour

The assistant is an interface to the workload intelligence system, not the authority responsible for scheduling.

It should support natural-language interactions such as:

- "I have a database assignment due next Friday."
- "This project will probably take longer than expected."
- "I couldn't finish yesterday's work."
- "Move the presentation preparation to the weekend."
- "What should I work on today?"
- "Can I realistically accept another project?"

The assistant must:

1. Extract structured information.
2. Query the existing workload.
3. Identify relevant constraints.
4. Request missing information when necessary.
5. Invoke the deterministic scheduling engine.
6. Explain proposed changes.
7. Obtain user approval before applying changes.

The LLM must not directly modify scheduling records or invent successful operations.

---

# 8. Technical Architecture

## Frontend

**React + TypeScript**

Suggested components:

- Dashboard.
- Commitment creation interface.
- Commitment detail page.
- Calendar and schedule view.
- Workload visualization.
- Assistant panel.
- Notification centre.
- Settings and availability configuration.

Recommended libraries:

- Tailwind CSS.
- FullCalendar.
- Recharts.
- React Query.
- React Hook Form.

## Backend

**FastAPI + Python**

Suggested modules:

| Module | Responsibility |
|---|---|
| commitment_service | Commitment CRUD and validation |
| estimation_service | AI-based effort estimation |
| learning_service | Personal estimate calibration |
| workload_service | Capacity and pressure calculation |
| scheduler_service | Scheduling and optimization |
| progress_service | Session and completion tracking |
| notification_service | Reminder generation and delivery |
| assistant_service | Natural-language interaction |

## Database

SQLite for the initial release.

Core entities:

- Users.
- Commitments.
- Subtasks.
- Dependencies.
- Availability.
- Work sessions.
- Actual effort records.
- Schedule proposals.
- Schedule entries.
- Notifications.
- Estimation history.

All timestamps should be timezone-aware. Store timestamps consistently and render them in the user's local timezone.

## Background Processing

Use APScheduler for the initial implementation, with a persistent application deployment.

Ensure scheduled jobs are recoverable after application restarts and that duplicate notifications are prevented.

For production scaling, introduce a durable job queue and separate worker process.

---

# 9. Four-Hour Coding-Agent Benchmark

## Objective

Determine whether the selected coding-agent environment can independently convert a reasonably complex product specification into a functional, tested and deliverable application within four hours.

The user acts primarily as product owner and reviewer rather than manually implementing the application.

## Required MVP

The agent must deliver:

1. Functional React frontend.
2. FastAPI backend.
3. Persistent commitment storage.
4. AI-based effort estimation.
5. User-editable effort estimates.
6. Multiple commitment management.
7. Daily availability configuration.
8. Deterministic workload calculation.
9. Multi-commitment scheduling.
10. Conflict detection.
11. Schedule proposal and approval.
12. Progress updates and rescheduling.
13. At least one functioning reminder mechanism.
14. Basic automated tests.
15. Setup and execution instructions.

The application must work end to end.

## Four-Hour Timeline

| Time | Expected milestone |
|---|---|
| 00:00–00:25 | Specification analysis, architecture and setup |
| 00:25–01:00 | Database models, backend and commitment APIs |
| 01:00–01:35 | AI extraction and effort estimation |
| 01:35–02:25 | Workload engine and scheduling algorithm |
| 02:25–03:05 | React dashboard and calendar |
| 03:05–03:35 | Approval workflow, progress and rescheduling |
| 03:35–03:50 | Reminder integration |
| 03:50–04:00 | Testing, debugging and delivery |

The timeline is a target, not permission to sacrifice core correctness to hit individual milestones.

## Acceptance Criteria

### A. Commitment Management

- A user can create at least three different commitments.
- Each commitment has a deadline and effort estimate.
- Estimates can be manually modified.
- Commitments persist after application restart.

### B. Estimation

- A natural-language description produces structured commitment information.
- The response contains an effort estimate.
- The user can override the estimate.
- The application remains usable if the AI provider is unavailable.

### C. Scheduling

- At least three commitments can be scheduled together.
- Sessions are distributed across available days.
- Daily capacity is respected.
- Sessions do not overlap.
- Dependencies are respected.
- Unallocated effort is reported.
- Infeasible schedules are identified.

### D. Conflict Detection

- Adding a new commitment triggers workload recalculation.
- Existing commitments affected by the new workload are identified.
- The application explains why the schedule is under pressure.

### E. Rescheduling

- A missed session preserves its unfinished effort.
- A new schedule proposal is generated.
- Existing approved sessions are not silently overwritten.
- User approval is required to apply changes.

### F. Adaptive Learning

- Actual completion time is recorded.
- Historical estimates are retained.
- Subsequent estimates can use previous user-specific data.
- Learning does not overwrite historical records.

### G. Reminders

- Upcoming work produces reminders.
- Duplicate reminders are prevented.
- Missed work triggers a rescheduling opportunity.
- Reminder delivery status is recorded.

### H. Delivery

- Frontend and backend start successfully.
- Core workflows can be demonstrated.
- No critical runtime errors remain.
- README includes installation and execution instructions.
- Known limitations are documented honestly.

---

# 10. Coding-Agent Evaluation Framework

Score the coding agent based on the actual application, not its self-reported completion status.

| Evaluation category | Weight |
|---|---:|
| Requirement understanding | 10 |
| Architecture and code organization | 10 |
| Backend implementation | 10 |
| AI integration and extraction | 10 |
| Scheduling algorithm correctness | 20 |
| Frontend functionality | 10 |
| Integration and state consistency | 10 |
| Testing and debugging | 10 |
| Delivery and documentation | 5 |
| Human intervention required | 5 |
| **Total** | **100** |

## Performance Interpretation

| Score | Interpretation |
|---|---|
| 90–100 | Excellent: capable of producing a credible shippable MVP |
| 80–89 | Strong: minor engineering intervention required |
| 70–79 | Usable: meaningful human supervision needed |
| 60–69 | Weak: struggles with integration or implementation |
| Below 60 | Poor fit for this four-hour development workflow |

A critical scheduling failure should also be recorded separately, regardless of the overall score.

## Intervention Tracking

Record:

- Number of prompts required.
- Number of manual code changes.
- Number of failed implementation attempts.
- Time spent debugging.
- Number of broken integrations.
- Whether the agent independently tests its implementation.
- Whether it can explain and correct its own mistakes.

A high score achieved through extensive manual intervention is not evidence of an autonomous coding workflow.

---

# 11. Benchmark Test Scenario

Use the following predefined test dataset to evaluate scheduling correctness.

**User availability:**

- Monday–Saturday.
- 4 working hours per day.
- Sunday unavailable.
- Maximum session length: 2 hours.

**Commitments:**

| Commitment | Deadline | Required effort |
|---|---|---:|
| Research project | Day 6 | 10 hours |
| Database assignment | Day 4 | 6 hours |
| Presentation | Day 7 | 5 hours |
| Personal project | Day 8 | 7 hours |

Total workload: 28 hours.

Available capacity: 28 hours across the eight-day planning horizon, assuming six available working days.

The system must:

1. Distribute all work across the available periods.
2. Respect all deadlines.
3. Respect the maximum daily capacity.
4. Split work into sessions no longer than two hours.
5. Preserve dependencies if introduced.
6. Report the absence of additional buffer.
7. Recalculate after a two-hour session is missed.
8. Identify whether all commitments remain feasible.

The test should also include a second scenario in which the user introduces an additional five-hour assignment. The system must identify the resulting capacity deficit rather than conceal it.

All expected outcomes should be independently checked against the scheduler's constraints.

---

# 12. Explicitly Out of Scope for the Four-Hour MVP

Do not implement these during the benchmark:

- Native Android or iOS applications.
- Full Google Calendar synchronization.
- Complex multi-agent architectures.
- Voice interaction.
- Advanced machine-learning training.
- Team collaboration.
- Payment systems.
- Sophisticated gamification.
- Full PDF document understanding.
- Autonomous modification of user commitments.

These features can be considered after the core planning engine has been validated.

---

# 13. Definition of Success

The experiment is successful if the coding agent produces a working application in which a user can:

1. Enter several commitments.
2. Receive editable AI effort estimates.
3. Configure available working hours.
4. Generate a distributed schedule.
5. Identify workload conflicts.
6. Approve the proposed schedule.
7. Record actual progress.
8. Miss a planned session and receive a revised proposal.
9. See how historical completion data affects future estimates.
10. Receive at least one functioning reminder.

The product must demonstrate genuine scheduling correctness, not merely a visually convincing calendar.

**Final product principle:**

The application should not tell users that they have too much to do and leave them to figure it out. It should calculate what needs to happen, explain the trade-offs, and help them make a realistic plan they can actually follow.