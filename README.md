# Fließend Deutsch Academy Management System

Production-oriented CRM + ERP for a German language academy, built with Next.js 15, Supabase Auth/Postgres/RLS, Tailwind, shadcn-style components, Resend reports, Vercel cron, and next-pwa offline attendance sync.

## Setup

1. Install dependencies: `npm install`
2. Copy environment variables: `cp .env.example .env.local`
3. Create a Supabase project and fill:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Run SQL migrations in order from [supabase/migrations](/home/nour/Desktop/fliessend%20deutch/supabase/migrations) in Supabase SQL editor or via Supabase CLI.
5. Seed sample data: `npm run seed`
6. Start locally: `npm run dev`
7. Verify production build: `npm run build`

## Environment Variables

See [.env.example](/home/nour/Desktop/fliessend%20deutch/.env.example). Keep `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and `CRON_SECRET` server-only.

## Role Breakdown

Admin: dashboard, students, classes, HR attendance, payroll, adjustments, HR performance, sales, accounts, treasury, reports, exams, feedback, branches, QR links, users.

Reception: student attendance, teacher attendance, students. No treasury, payroll, leads, or adjustments unless `permissions.sales_access` allows read-only assigned leads.

Sales: assigned files, assigned leads, interactions, student conversion for booked leads. No treasury, payroll, or student attendance.

Teacher: own attendance and own classes only.

## Supabase RLS

All requested tables are created in the migration and have RLS enabled. Admin policies provide full access. Reception, sales, and teacher policies are scoped by role, ownership, and `users.permissions` JSONB. Treasury and payroll-sensitive tables are admin-only.

## Vercel Cron

[vercel.json](/home/nour/Desktop/fliessend%20deutch/vercel.json) schedules:

```json
{ "path": "/api/reports/daily?secret=$CRON_SECRET", "schedule": "0 19 * * *" }
```

This is 22:00 Cairo time while Cairo is UTC+3. The route can also be called manually from `/admin/dashboard`.

## Custom Domain DNS on Vercel

1. In Vercel, open the project, then Settings → Domains.
2. Add `www.fliessend-deutsch.com`.
3. At the DNS provider, add a CNAME record:
   - Name: `www`
   - Value: `cname.vercel-dns.com`
4. For an apex domain, use Vercel's recommended A record:
   - Name: `@`
   - Value: `76.76.21.21`
5. Wait for Vercel to show “Valid Configuration”, then set `NEXT_PUBLIC_SITE_URL=https://www.fliessend-deutsch.com`.

## Implemented Modules

Authentication, user management, HR attendance, payroll, adjustments, lead import, lead board, admin sales overview, students, classes, treasury, daily email report, offline queue for student/teacher attendance, health endpoint, seed script, and Supabase migrations are included.

Client-requested additions now included:
- Separate Accounts area for student payments, received-by, amount, lecturer, course, due date, receipt number, and per-course totals.
- Separate Reports area for daily/monthly revenue, expenses, profit, bookings, attendance, follow-ups, campaign performance, and sales comparisons.
- Branch management for future multi-branch operation.
- Teacher and student portal links with QR codes.
- Printable student receipt pages.
- Exam management for placement, internal, and ÖSD bookings with result level, score percentage, and comments.
- Student and teacher feedback records tied into the student profile.
- HR performance records for vacations, penalties, performance notes, sales follow-ups, and monthly bookings.

Still needs client confirmation: exact KPI scoring weights/formulas. Current reports show raw counts and totals so the business owner can validate the rules first.

## Health Check

`/api/health` returns `{ status: "ok", timestamp, version }`.
