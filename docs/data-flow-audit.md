# Fließend Deutsch: Full Data-Flow Audit

**Audit date:** 2026-10-13  
**Scope:** Next.js App Router, local mock mode, Supabase schema/migrations, browser forms, API routes, RLS, and the teacher-account defect reported from Supabase Table Editor.

## 1. How data is selected

There are three data layers in this application:

1. **Authentication identity**
   - Hosted mode: Supabase `auth.users` owns the real login identity and password.
   - Local mode: `/api/local-login` reads the local mock `users` rows and compares `password_hash`.
   - `middleware.ts` and `getCurrentUser()` use the authenticated identity to decide whether a request is allowed.

2. **Academy records**
   - Hosted mode: `createSupabaseServerClient()` and `createSupabaseBrowserClient()` read/write PostgreSQL through Supabase and RLS.
   - Server-side employee creation additionally uses the service-role client in `/api/employees`; that key must remain server-only.
   - Browser forms generally write directly through the authenticated browser Supabase client.

3. **Local build mode**
   - When the public Supabase URL/key are absent, `lib/local-db.ts` implements a Supabase-shaped in-memory query layer.
   - The seeded rows are defined in `lib/local-db.ts`, including 50 students, classes, teachers, leads, accounts, exams, attendance, payroll, logs, and books.
   - Local writes persist only while that process is alive. Restarting the dev server resets them. This is expected for building without a database.

### Identity relationship that matters

```text
auth.users.id
      |
      v
public.users.id  -- login profile, role, permissions, email, payroll
      |
      +--> public.teachers.user_id  -- teaching profile, teacher pay settings
                                      |
                                      +--> public.classes.teacher_id
```

`users.id` and `teachers.id` are intentionally different IDs. A role of `teacher` in `users` does not by itself make a teacher selectable in Classes; a linked row in `teachers` is required.

## 2. Table-by-table source of truth

### Identity and organization

| Table | Stored fields / meaning | Created or changed by | Read by |
| --- | --- | --- | --- |
| `auth.users` | Supabase account ID, auth email, password, auth metadata | Supabase Auth; `/api/employees` admin client | Supabase Auth, middleware |
| `users` | `id`, `full_name`, `email`, `role`, `is_active`, `permissions`, payroll type/rates, local password hash | Account Center/API; local-login seed; admin update | auth profile, dashboard, payroll, HR, sales assignment, exams, logs |
| `teachers` | `id`, `user_id`, `name`, `phone`, `pay_type`, `base_rate`, `portal_token` | Account Center teacher repair/API; teacher manager/seed | Classes, teacher attendance, teacher follow-up, payroll, portals, feedback |
| `branches` | name, address, phone, active flag | Branch form | student/class/treasury forms and filters |
| `audit_logs` | actor, action, entity type/id, JSON detail, timestamp | `recordAudit()` after client mutations; seed | Admin Logs |

### Teaching and attendance

| Table | Stored fields / meaning | Source of values | Consumers |
| --- | --- | --- | --- |
| `classes` | name, level, mode, branch, teacher, schedule string, capacity, chapter, total sessions, completed sessions, status, last completed date | Class Manager; class Excel import; local seed; session-progress helper | Students, attendance, dashboard, exams, follow-up, class print/export |
| `student_attendance` | student, class, date, status, recorder; unique per student/class/date | Reception bulk attendance; student portal QR; local seed | class progress, reports, dashboard, student/teacher follow-up |
| `teacher_attendance` | teacher, date, check-in/out, sessions, notes, recorder | Employees Check In / teacher attendance form; student/class progress reads it | payroll, dashboard, daily report, teacher portal |
| `employee_attendance` | `users.id`, date, check-in/out, notes, recorder | Employees Check In for reception/sales/admin workers | payroll, dashboard, HR performance |
| `teacher_adjustments` | teacher bonus/deduction, amount, reason, date range | HR adjustments | teacher payroll |
| `employee_adjustments` | worker user, bonus/deduction, amount, reason, date range | HR performance/adjustment flow | worker payroll |
| `employee_events` | user or teacher, vacation/penalty/performance note, date, amount/score, notes | HR performance | HR performance/KPI view |

### Students and finance

| Table | Stored fields / meaning | Source of values | Consumers |
| --- | --- | --- | --- |
| `students` | name, phone/email, level/tags, class, mode, price, paid amount, payment date/comment, status, freeze dates/months, completed-stopped flag, branch, portal token | Student Manager; sales conversion; Excel import; student promotion; local seed | Students list, profiles, follow-up, reports, portals, receipts |
| `student_account_records` | per-payment amount, class/teacher, receiver, due date, paid date, status, notes, receipt number | Reception Accounts entry; receipt workflow | receipts, student profile, reports, dashboard alerts |
| `treasury_records` | income/expense, amount, description, category, date, branch, creator | Admin Treasury; Reception limited entry | Treasury, dashboard, Reports, daily report |
| `textbook_inventory` | title, level/edition, on-hand/needed/ordered quantities, order/delivery dates, supplier, notes | Textbook Inventory form/import | dashboard alerts, textbook screen |

### Exams and feedback

| Table | Stored fields / meaning | Source of values | Consumers |
| --- | --- | --- | --- |
| `exam_records` | student, type (`placement`, `osd`, `internal`, later quiz/main values), scheduled time, result level, score, comment, booking status, booked class | Exams form/import; reception exam entry | Exams, profiles, follow-up, promotion candidates, portals |
| `feedback_records` | student, teacher, source (`student`/`teacher`), rating, comment, creator, timestamp | Feedback form; teacher follow-up | Admin/teacher follow-up, student profile, teacher portal |
| `student_worker_feedback` | student, target teacher or reception user, role, private comment, timestamp | Student portal feedback API | Admin HR performance and admin student follow-up only |

### CRM

| Table | Stored fields / meaning | Source of values | Consumers |
| --- | --- | --- | --- |
| `lead_files` | campaign/file name, uploader, upload date, count | Lead import API | Sales files, permissions, admin CRM |
| `leads` | name, phone, source, file, status, assignee, converted student, tags, flexible `crm_data` | CSV/XLSX import; CRM row editing; assignment; status changes; conversion | Admin/Sales CRM, dashboard, reports |
| `lead_interactions` | immutable note, creator, timestamp, lead | CRM interaction form | CRM timeline, reports, sales KPIs |
| `lead_reminders` | lead, recipient, due date, note, read timestamp | CRM waiting/reminder API | reception/sales/admin notification endpoint |

### Saved data and reporting

| Table | Stored fields / meaning | Source of values | Consumers |
| --- | --- | --- | --- |
| `manual_sheets` | owner, name, JSON columns, JSON rows, timestamps | Manual Sheet API | CRM list tabs / sales-owned lists / admin lists |
| `report_snapshots` | owner, report section, JSON exported/imported rows, timestamps | Report import/export API | Reports page export/import state |

## 3. Page-by-page reads

### Admin and system

- **Dashboard** (`/admin/dashboard`): students/status; classes/schedule/status/session counters; student and teacher attendance; teacher and employee counts; treasury income/expense; leads and interactions; exam schedule/booking; textbook quantities; account payment status/due dates. The cards are derived aggregates, not a separate dashboard table.
- **Account Center / Users**: `users` plus `lead_files` for permission file selection. Account Center also calls `ensureTeacherProfile()` for every teacher-role user, which creates or updates the matching `teachers` row.
- **Logs**: `audit_logs` only. The `details` field is JSON by design; the UI should format known action/entity combinations into readable sentences and use a fallback for unknown details.
- **Branches**: `branches`.
- **Links and QR**: students and teachers, specifically `portal_token`; tokens are generated in the page if missing and are used in `/portal/...` and student attendance URLs.

### Students and classes

- **Students**: `students` joined to `classes(name, teachers(name))`; `classes` supplies promotion destinations; `exam_records` supplies the latest result used for promotion eligibility.
- **Student profile/receipt**: the selected student plus all `student_account_records`, `exam_records`, `feedback_records`, `student_attendance`, and class/teacher lookup rows.
- **Admin and reception student follow-up**: students, classes, teachers, payment records, exam records, feedback, attendance, and worker feedback. The teacher version uses the same basic student data but is scoped to classes belonging to the logged-in teacher and does not expose print/PDF actions.
- **Classes**: classes with nested students and teacher names; a separate teachers query populates the teacher selector. Class session completion is refreshed using present student scans plus a teacher check-in.
- **Students Check In**: classes with nested students; submission writes `student_attendance` for selected rows.

### Employees and HR

- **Employees Check In**: `teachers` for teachers and active non-teacher `users` for workers. Teacher records write `teacher_attendance`; worker records write `employee_attendance`.
- **HR Performance**: `employee_events`, users, teachers, monthly lead interactions/bookings, students, and private worker feedback. Payroll rows are calculated separately by `lib/payslip.ts`.
- **Payroll calculation**: teacher rows come from `teachers + teacher_attendance + teacher_adjustments`; all other workers come from active `users + employee_attendance + employee_adjustments`. Hourly, monthly wage, monthly salary, and teacher per-session/fixed calculations are performed in `lib/payslip.ts`.
- **Teacher classes/attendance**: first resolves the teacher profile by `teachers.user_id = current user id`, then reads only that teacher's classes or attendance.

### CRM and accounts

- **Admin/Sales CRM**: leads with nested interactions/users, users with role `sales`, lead interaction counts, and booking counts. Sales page adds an RLS-compatible filter on its own `assigned_to` and assigned file IDs.
- **Lead files**: sales users and lead files; import creates a `lead_files` row and then lead rows, and can update the assignee's `permissions.assigned_files`.
- **Accounts**: student account records, class/teacher/receiver references in the form, and student-linked account history. Reception sees only the entry form; Admin sees entry, totals, per-course rows, and search.
- **Treasury**: `treasury_records`; dashboard and Reports aggregate the same records by date/month/category.
- **Reports**: treasury, student attendance, teacher attendance, lead interactions, leads, lead files, users, classes, and student account records. Import/export snapshots are separate JSON rows in `report_snapshots`; importing a snapshot does not alter live operational data.

## 4. Page-by-page writes

| Workflow | Exact write destination | Notes |
| --- | --- | --- |
| Create employee | Supabase Auth plus `users`; teacher role additionally `teachers` | `/api/employees` uses service role for account creation. Existing teacher users are repaired when Account Center loads. |
| Edit employee | `users`; teacher role syncs `teachers.name/pay_type/base_rate` | Payroll fields remain on `users` for workers and on `teachers` for teacher payroll. |
| Reset password | Auth account/password path plus local password hash path | Hosted and local reset paths should be tested separately; reset email requires Resend configuration. |
| Student create/edit | `students` | Payment totals, freeze dates, tags, class, mode and stopped-level flag are all student fields. |
| Student promotion | `students.class_id`, `students.level`, `students.level_completed_stopped`; `audit_logs` | Destination is selected from existing `classes`, not hardcoded. |
| Class create/edit/import | `classes` | Class Manager updates schedule, level, mode, teacher, capacity, chapter, sessions and status. |
| Class session progress | `classes.sessions_done`, `last_session_completed_date`, `class_status` | `refreshClassSessionProgress()` qualifies a date only when at least three students are present and the assigned teacher checked in. |
| Student attendance | `student_attendance` insert/update | Unique student/class/date prevents duplicate daily rows. |
| Teacher attendance | `teacher_attendance` insert/update | One teacher/date row. |
| Worker attendance | `employee_attendance` insert/update | One user/date row. |
| Payroll adjustment | `teacher_adjustments` or `employee_adjustments` | Different table depending on teacher vs non-teacher. |
| Account entry | `student_account_records` | Reception can insert; admin can manage all. |
| Treasury entry | `treasury_records` | Admin manages all; reception has insert-only policy. |
| Exam entry/import | `exam_records` | Placement, ÖSD, internal, quiz/main records are stored as rows differentiated by `exam_type`. |
| Teacher/student feedback | `feedback_records` | Student and teacher feedback share a table and are separated by `source`. |
| Student worker complaint | `student_worker_feedback` | API validates the portal token and verifies the selected teacher belongs to the student's class. |
| CRM import/edit/assignment | `lead_files`, `leads`, `users.permissions`, `lead_interactions`, `lead_reminders` | Bulk assignment changes `leads.assigned_to`; file visibility uses assigned file IDs and RLS. |
| Manual list | `manual_sheets` | JSON columns/rows are saved by owner; it is a spreadsheet-like feature, not a normalized CRM table. |
| Report import/export | `report_snapshots` | Snapshot rows are deliberately separate from live records. |
| Books | `textbook_inventory` | Form and import both write the same inventory table. |
| Audit/security | `audit_logs`; deletion also calls `/api/security-alert` | The audit insert is client-triggered after the mutation, so a failed log insert does not roll back the business mutation. |

## 5. Role and RLS audit

## 5A. Exact field-origin map

This is the field-level map for the columns users see most often. A value shown in a table is not necessarily calculated in that component; the right-hand source is the authoritative origin.

| Visible value | Exact source | Calculation or join |
| --- | --- | --- |
| Student name | `students.full_name` | Direct |
| Student phone/email | `students.phone`, `students.email` | Direct |
| Student level | `students.level` | Direct; exam result is separate until promotion |
| Student class name | `classes.name` through `students.class_id` | Join |
| Student teacher | `teachers.name` through `classes.teacher_id` | Two-step join |
| Student mode | `students.learning_mode` | Direct; class mode is `classes.learning_mode` |
| Student tags | `students.tags` | Array converted to text for search/export |
| Price | `students.total_price` | Direct |
| Paid | `students.amount_paid` | Direct; account history is separate |
| Not paid | `students.total_price - students.amount_paid` | Calculated in UI |
| Payment status | `student_account_records.status` when a payment row exists; otherwise derived from student totals/due date | Latest/account-row logic varies by screen |
| Payment date | `students.payment_due_date` for the arranged date; individual due dates are `student_account_records.due_date` | Two concepts must not be confused |
| Payment comment | `students.payment_comment` | Direct student-level arrangement note |
| Freeze start/end | `students.freeze_start_date`, `students.freeze_end_date` | Direct; expired state is date comparison |
| Freeze duration | `students.freeze_months` | Direct, constrained to 0-3 |
| Finished and stopped | `students.level_completed_stopped` | Direct boolean |
| Class schedule | `classes.schedule` | Stored display string; it can contain multiple day/time entries |
| Stopped at/chapter | `classes.current_chapter` | Direct |
| Class progress | `classes.sessions_done / classes.total_sessions` | Display calculation |
| Class status/color | `classes.class_status` | Direct enum-like text: not_started, started, finished |
| Class teacher | `classes.teacher_id -> teachers.id` | Join |
| Student check-in | `student_attendance.status` | Filtered by student/class/date |
| Employee check-in | `employee_attendance.check_in/check_out` | Joined by `employee_attendance.user_id = users.id` |
| Teacher check-in | `teacher_attendance.check_in/check_out` | Joined by `teacher_attendance.teacher_id = teachers.id` |
| Teacher base pay | `teachers.pay_type`, `teachers.base_rate` | Hourly, per-session, or fixed calculation |
| Worker base pay | `users.payroll_type`, `users.monthly_salary`, `users.monthly_wage`, `users.hourly_rate` | Hourly or monthly calculation |
| Bonuses/deductions | `teacher_adjustments` or `employee_adjustments` | Summed inside selected payroll period |
| Net payable | payroll base + bonuses - deductions | `lib/payslip.ts` |
| Lead assignee | `leads.assigned_to -> users.id` | Admin assignment; sales visibility also checks assigned file |
| Lead campaign | `leads.source` and/or `lead_files.name` | Import maps campaign to source/file |
| Lead tags | `leads.tags` | Text array; CRM filter uses case-insensitive substring |
| Lead contact columns | `leads.crm_data` JSON keys | `first_date`, `contact_1`, `second_date`, `contact_2`, `third_date`, `comment_hossam`, `fourth_date`, `comment_kayther`, `next_follow_up`, reminder fields |
| Lead status | `leads.status` | `waiting` is used to move a lead into the waiting list |
| Follow-up count | `lead_interactions.created_at` grouped by creator/date | Calculated query result |
| Booking count | `leads.status = booked` grouped by assignee/date | Calculated query result |
| Student income | `student_account_records.amount` for account entries; treasury income is `treasury_records.amount` where type is income | These are separate accounting concepts |
| Treasury income/expense | `treasury_records.type`, `amount`, `date` | Date/month/category aggregation |
| Exam date/result | `exam_records.scheduled_at`, `level_result`, `score_percent`, `result_comment` | One student can have many exam rows |
| Exam booking | `exam_records.booking_status`, `booked_class_id` | Booked group joins `classes.id` |
| Student feedback | `feedback_records.source = student` | Rating/comment with teacher/student references |
| Private worker feedback | `student_worker_feedback` | Admin-only view; target is a `users` receptionist or `teachers` teacher |
| Portal link/QR | `students.portal_token` or `teachers.portal_token` | Random token, never derived from sequential student IDs |
| Book stock | `textbook_inventory.quantity_on_hand/needed/ordered` | “Needs order” is a quantity comparison/row status |
| Log actor | `audit_logs.actor_name`, `actor_email`, `actor_user_id` | Captured when `recordAudit()` runs |
| Log explanation | `audit_logs.action`, `entity_type`, `entity_id`, `details` | `details` is JSON storage; UI must convert it to readable text |

## 5B. Route query inventory

The following is the route-to-query inventory used during this audit. It is intentionally explicit so future changes can be checked against it.

| Route | Main reads |
| --- | --- |
| `/admin/dashboard` | students, classes, student_attendance, teacher_attendance, teachers, employee_attendance, treasury_records, leads, lead_interactions, exam_records, textbook_inventory, student_account_records |
| `/admin/students` | students with class/teacher relation, classes, exam_records |
| `/admin/students/[id]` | one student, account records, exams, feedback, attendance, classes, teachers |
| `/reception/students` | students with class/teacher relation, classes |
| `/admin/classes` | classes with nested students/teachers, teachers |
| `/teacher/classes` | current user's teacher row, that teacher's classes |
| `/admin/student-attendance` | classes with nested students |
| `/reception/attendance/students` | classes with nested students |
| `/admin/hr/attendance` | teachers; active non-teacher users |
| `/reception/attendance` | teachers; active non-teacher users |
| `/teacher/attendance` | current user's teacher row, own teacher attendance |
| `/admin/hr/performance` | employee events, users, teachers, lead interactions, booked leads, students, worker feedback |
| `/admin/hr/adjustments` | teachers, teacher adjustments |
| `/admin/account-center` | users, lead files; repairs teacher profiles |
| `/admin/users` | users, lead files |
| `/admin/sales` | leads with interactions/users, sales users, weekly interactions, monthly bookings |
| `/sales/leads` | only leads assigned to current user and permitted files |
| `/admin/sales/files` | sales users, lead files, leads |
| `/sales/files` | lead files whose IDs are in current user's `permissions.assigned_files` |
| `/admin/reports` | treasury, student/teacher attendance, lead interactions, leads/files, users, classes, account records |
| `/admin/treasury` | treasury_records |
| `/admin/accounts` | student account records and related student/class/teacher/receiver data |
| `/admin/exams` | students, classes, teachers, users, account records, exam records, feedback, attendance, worker feedback |
| `/admin/exams-management` | students, classes, exam records |
| `/admin/feedback` | feedback records, students, teachers |
| `/admin/teacher-follow-up` | students, classes, teachers |
| `/teacher/follow-up` | own teacher, own classes, student profile fields, accounts, exams, feedback, attendance |
| `/admin/links` | students and teachers with portal tokens |
| `/portal/student/[token]` | token-matched student, class, exams, feedback, attendance |
| `/portal/teacher/[token]` | token-matched teacher, classes, attendance, feedback |
| `/attendance/student/[token]` | token-matched student/class, duplicate attendance check, teachers, reception users |
| `/admin/logs` | audit_logs |
| `/admin/textbooks` | textbook_inventory |
| `/admin/branches` | branches |

API routes add the following server-side sources: `/api/employees` uses auth plus users and teachers; `/api/payroll` uses users and payroll aggregation; `/api/leads/import` uses lead_files, leads, and user permissions; `/api/lead-reminders` uses users, lead_reminders, and leads; `/api/student-worker-feedback` uses students, classes, users, and student_worker_feedback; `/api/reports/daily` aggregates attendance, classes, treasury, interactions, and booked leads; `/api/manual-sheets` uses manual_sheets; `/api/report-snapshots` uses report_snapshots.

- **Admin:** full access to core tables and administrative modules.
- **Reception:** student/class reads, attendance writes, account writes, exam/feedback writes, and treasury inserts. It does not receive admin treasury reads through RLS.
- **Sales:** assigned lead files/leads/interactions and student inserts for conversion. Lead visibility is constrained by both `assigned_to` and `permissions.assigned_files`.
- **Teacher:** own teacher row/classes/attendance and students connected through own classes. Teacher follow-up is read-scoped; teacher feedback is writable for the own teacher row.
- **Student portal:** uses token-based public-facing route handling rather than a normal worker role. The portal API validates the token and class/teacher relationship before attendance or worker feedback writes.

### Important security observations

1. The database is the final authority in hosted mode. Hiding a nav item is not a permission check.
2. `student_worker_feedback` is admin-readable only, so it is not printed in payslips.
3. `audit_logs` allows authenticated inserts but only admins can read them. Because logging is called from the browser after a mutation, server-side mutation auditing would be stronger for production.
4. The local database is intentionally not a security boundary and should never be treated as production persistence.
5. `users.email` is the academy login/profile email; hosted auth also has its own email. Those values should be kept synchronized by the employee API.

## 6. Findings from the reported teacher defect

### What happened

The Account Center created the login/profile row in `users`, but Classes queried `teachers`. Therefore the new person appeared in Supabase `users` with role `teacher` but not in the teacher selector.

### What is fixed

- `/api/employees` now creates or updates the linked `teachers` row for a teacher-role employee.
- Account Center runs a repair pass for existing teacher-role users that have no teacher row.
- Payroll settings are translated from the employee form into the teacher profile: hourly becomes `teachers.pay_type = hourly`; salary/wage uses the fixed teacher pay path while the worker payroll fields remain on `users`.
- Local query compatibility now includes `maybeSingle()`, so this repair also works in local build mode.

### Verification required against the client database

1. Open Account Center once after deployment, or call the employee update path, to repair already-created teacher users.
2. Query `teachers` and confirm `user_id` equals the teacher's `users.id`.
3. Open Classes and confirm the teacher appears in the selector.
4. Create a class, then confirm `classes.teacher_id` equals the `teachers.id`, not the `users.id`.
5. Open teacher attendance/follow-up and confirm the route resolves the same linked teacher profile.

## 7. Translation audit and why it was incomplete

The application currently has two translation mechanisms:

- `lib/i18n.ts` translates the shared shell and navigation.
- `ArabicUiTranslator` uses a browser text-node replacement list for older feature components that still contain English literals.

The second mechanism is why screenshots can show Arabic navigation while the content remains English: a string is translated only if its exact text exists in the replacement list. Dynamic labels, placeholders, table values, and new feature text can bypass it. This is the reason the earlier translation pass did not fix every screen.

Known high-risk screens are Accounts, HR Performance, Account Center, CRM, Reports, Exams, Textbook Inventory, and the manual sheet. Their exact field names and action labels should be moved into component-level dictionaries rather than relying only on DOM replacement. The replacement map has been expanded for employee creation, payroll, class management, exams, logs, reports, accounts, and common table labels, but a final translation pass still needs visual checking in both directions.

## 8. Recommended next verification order

1. Hosted database: verify teacher link repair and class assignment using the five checks above.
2. Arabic: visit every route from the grouped sidebar, toggle Arabic, and record remaining English literals by route.
3. RLS: test one account per role directly against each restricted table, especially treasury, payroll, worker feedback, leads, and teacher-scoped student data.
4. Persistence: refresh every page in hosted mode and verify that changes remain; restart local mode and expect seeded data to return.
5. Audit integrity: create, edit, and delete a student/class/lead/account record and confirm a readable `audit_logs` entry is produced for each mutation.
6. Performance: replace broad `select("*")` profile queries with field lists where practical, paginate large tables at the database layer, and avoid loading all attendance/exam history into every follow-up page.
