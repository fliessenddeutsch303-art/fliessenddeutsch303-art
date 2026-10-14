import type { Role, UserProfile } from "@/lib/types";

type Row = Record<string, any>;
type Result<T = any> = { data: T; error: null; count?: number | null };

const now = new Date().toISOString();
const today = new Date().toISOString().slice(0, 10);

const ids = {
  admin: "local-admin",
  reception: "local-reception",
  sales: "local-sales",
  teacherUser: "local-teacher-user",
  teacher: "local-teacher",
  teacher2: "local-teacher-2",
  classA1: "local-class-a1",
  classB1: "local-class-b1",
  classB2: "local-class-b2",
  classA2: "local-class-a2",
  file: "local-file",
  branch: "local-branch-main",
};

const mockStudentNames = [
  "Omar Hassan", "Mariam Adel", "Youssef Nabil", "Salma Tarek", "Karim Samir", "Laila Mostafa", "Adam Fathy", "Nour Khaled", "Hana Mahmoud", "Ibrahim Ashraf",
  "Mina George", "Jana Hany", "Ahmed Ezzat", "Farah Wael", "Ziad Emad", "Malak Hossam", "Ali Sherif", "Reem Ayman", "Seif Magdy", "Nada Amr",
  "Yara Sameh", "Tamer Fawzy", "Huda Osama", "Bassem Walid", "Aya Essam", "Mahmoud Reda", "Dina Hatem", "Ramy Mostafa", "Sara Fadel", "Khaled Sayed",
  "Lina Nasser", "Hassan Ibrahim", "Joudy Karim", "Mostafa Yehia", "Mariam Fares", "Anas Galal", "Rana Hisham", "Othman Adel", "Maya Rami", "Fady Nabil",
  "Nada Fathy", "Hany Saad", "Lamar Tarek", "Sherif Amin", "Jana Omar", "Yassin Atef", "Aya Nader", "Rania Samir", "Sami Khalil", "Farida Ashraf",
];

const db: Record<string, Row[]> = {
  users: [
    { id: ids.admin, full_name: "Admin", email: "admin@local.test", role: "admin", is_active: true, permissions: {}, payroll_type: "monthly_salary", monthly_salary: 18000, monthly_wage: 0, hourly_rate: 0, password_hash: "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9", created_at: now },
    { id: ids.reception, full_name: "Reception", email: "reception@local.test", role: "reception", is_active: true, permissions: {}, payroll_type: "monthly_salary", monthly_salary: 9000, monthly_wage: 0, hourly_rate: 0, password_hash: "5145dba3b6bda2d610d2c5c435a1c2481eefd3146b6a7e004ad73f794386e031", created_at: now },
    { id: ids.sales, full_name: "Ahmed Sales", email: "sales@local.test", role: "sales", is_active: true, permissions: { assigned_files: [ids.file] }, payroll_type: "hourly", monthly_salary: 0, monthly_wage: 0, hourly_rate: 120, password_hash: "6bc0a63cb29c92306020c0a6bbc358cc4628db277dc06e253535e126517ad637", created_at: now },
    { id: "local-sales-2", full_name: "Mona Sales", email: "sales2@local.test", role: "sales", is_active: true, permissions: { assigned_files: [ids.file] }, payroll_type: "hourly", monthly_salary: 0, monthly_wage: 0, hourly_rate: 130, password_hash: "6bc0a63cb29c92306020c0a6bbc358cc4628db277dc06e253535e126517ad637", created_at: now },
    { id: ids.teacherUser, full_name: "Teacher", email: "teacher@local.test", role: "teacher", is_active: true, permissions: {}, payroll_type: "monthly_salary", monthly_salary: 0, monthly_wage: 0, hourly_rate: 0, password_hash: "cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416", created_at: now },
  ],
  teachers: [
    { id: ids.teacher, user_id: ids.teacherUser, name: "Herr Müller", phone: "01000000001", portal_token: crypto.randomUUID().replaceAll("-", ""), pay_type: "hourly", base_rate: 250, created_at: now },
    { id: ids.teacher2, user_id: null, name: "Frau Schneider", phone: "01000000002", portal_token: crypto.randomUUID().replaceAll("-", ""), pay_type: "per_session", base_rate: 400, created_at: now },
  ],
  branches: [
    { id: ids.branch, name: "Main Branch", address: "Nasr City", phone: "01000000000", is_active: true, created_at: now },
  ],
  classes: [
    { id: ids.classA1, name: "A1 Evening", teacher_id: ids.teacher, branch_id: ids.branch, level: "A1", current_chapter: "Kapitel 1", learning_mode: "offline", schedule: "Sunday 18:00 | Tuesday 19:30", capacity: 16, total_sessions: 12, sessions_done: 0, class_status: "not_started", last_session_completed_date: null, created_at: now },
    { id: ids.classB1, name: "B1 Morning", teacher_id: ids.teacher2, branch_id: ids.branch, level: "B1", current_chapter: "Kapitel 5", learning_mode: "online", schedule: "Monday 10:00 | Wednesday 11:30", capacity: 14, total_sessions: 12, sessions_done: 4, class_status: "started", last_session_completed_date: null, created_at: now },
    { id: ids.classB2, name: "B2 Weekend", teacher_id: ids.teacher, branch_id: ids.branch, level: "B2", current_chapter: "Kapitel 10", learning_mode: "offline", schedule: "Saturday 12:00 | Thursday 18:00", capacity: 18, total_sessions: 12, sessions_done: 12, class_status: "finished", last_session_completed_date: null, created_at: now },
    { id: ids.classA2, name: "A2 Intensive", teacher_id: ids.teacher2, branch_id: ids.branch, level: "A2", current_chapter: "Kapitel 2", learning_mode: "online", schedule: "Sunday 09:00 | Friday 15:30", capacity: 12, total_sessions: 16, sessions_done: 0, class_status: "not_started", last_session_completed_date: null, created_at: now },
  ],
  students: Array.from({ length: 50 }, (_, index) => ({
    id: `local-student-${index + 1}`,
    full_name: mockStudentNames[index],
    phone: `0101000000${index}`,
    email: `student${index + 1}@local.test`,
    portal_token: crypto.randomUUID().replaceAll("-", ""),
    level: index < 25 ? "A1" : "B1",
    tags: index % 2 === 0 ? ["electric company"] : ["water company"],
    class_id: index % 2 === 0 ? ids.classA1 : ids.classB1,
    branch_id: ids.branch,
    learning_mode: index % 2 === 0 ? "offline" : "online",
    total_price: 8500,
    amount_paid: index % 3 === 0 ? 3000 : 8500,
    payment_due_date: index % 3 === 0 ? new Date(Date.now() + (index === 0 ? -1 : 1) * 86400000).toISOString().slice(0, 10) : null,
    payment_comment: index % 3 === 0 ? "Arranged remaining payment with student." : "",
    freeze_start_date: index === 1 ? today : index === 2 ? new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10) : null,
    freeze_months: index === 1 ? 2 : index === 2 ? 1 : 0,
    freeze_end_date: index === 1 ? new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10) : index === 2 ? new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10) : null,
    level_completed_stopped: index === 3,
    status: "active",
    enrolled_at: now,
    created_at: now,
  })),
  teacher_attendance: [
    { id: "local-ta-1", teacher_id: ids.teacher, date: today, check_in: "10:00", check_out: "14:00", sessions_count: 0, notes: "Local sample", recorded_by: ids.reception },
  ],
  employee_attendance: [
    { id: "local-ea-1", user_id: ids.sales, date: today, check_in: "09:00", check_out: "17:00", notes: "Sales shift", recorded_by: ids.admin, created_at: now },
    { id: "local-ea-2", user_id: ids.reception, date: today, check_in: "10:00", check_out: "18:00", notes: "Reception shift", recorded_by: ids.admin, created_at: now },
  ],
  teacher_adjustments: [
    { id: "local-adj-1", teacher_id: ids.teacher, type: "bonus", amount: 500, reason: "Demo bonus", period_start: today, period_end: today, created_by: ids.admin, created_at: now },
  ],
  employee_adjustments: [
    { id: "local-eadj-1", user_id: ids.reception, type: "bonus", amount: 400, reason: "Extra front desk coverage", period_start: today, period_end: today, created_by: ids.admin, created_at: now },
    { id: "local-eadj-2", user_id: ids.sales, type: "deduction", amount: 200, reason: "Late arrival", period_start: today, period_end: today, created_by: ids.admin, created_at: now },
  ],
  student_attendance: [
    { id: "local-sa-1", student_id: "local-student-1", class_id: ids.classA1, date: today, status: "present", recorded_by: ids.reception },
    { id: "local-sa-2", student_id: "local-student-2", class_id: ids.classB1, date: today, status: "late", recorded_by: ids.reception },
  ],
  lead_files: [{ id: ids.file, name: "Local Facebook Campaign", uploaded_by: ids.admin, upload_date: now, total_leads: 5 }],
  leads: Array.from({ length: 5 }, (_, index) => ({
    id: `local-lead-${index + 1}`,
    full_name: `Lead ${index + 1}`,
    phone: `0102000000${index}`,
    source: "Local Facebook Campaign",
    tags: index % 2 === 0 ? ["Facebook", "A1 campaign"] : ["WhatsApp", "B1 campaign"],
    file_id: ids.file,
    status: index === 0 ? "booked" : index === 1 || index === 2 ? "waiting" : "new",
    assigned_to: ids.sales,
    converted_to_student_id: null,
    crm_data: {
      level: index % 2 === 0 ? "A1" : "B1",
      first_date: index === 0 ? today : "",
      contact_1: index === 0 ? "Asked about course schedule" : "",
      second_date: "",
      contact_2: "",
      third_date: "",
      comment_hossam: "",
      fourth_date: "",
      comment_kayther: "",
      next_follow_up: "",
      reminder_date: index === 1 ? new Date(Date.now() + 86400000).toISOString().slice(0, 10) : index === 2 ? today : "",
      reminder_note: index === 1 ? "Waiting for the B1 evening start date." : index === 2 ? "Waiting for the requested teacher to be confirmed." : "",
    },
    created_at: now,
  })),
  lead_interactions: [
    { id: "local-interaction-1", lead_id: "local-lead-1", note: "Asked about A1 schedule.", created_by: ids.sales, created_at: now },
  ],
  treasury_records: [
    { id: "local-tr-1", type: "income", amount: 12000, description: "Demo tuition", category: "Tuition", date: today, branch_id: ids.branch, created_by: ids.admin },
    { id: "local-tr-2", type: "expense", amount: 2500, description: "Demo rent", category: "Rent", date: today, branch_id: ids.branch, created_by: ids.admin },
    { id: "local-tr-3", type: "income", amount: 18000, description: "A1 course payments", category: "A1 Evening", date: today, branch_id: ids.branch, created_by: ids.admin },
  ],
  student_account_records: [
    { id: "local-ar-1", student_id: "local-student-1", class_id: ids.classA1, teacher_id: ids.teacher, received_by: ids.reception, amount: 3000, due_date: today, paid_at: null, status: "overdue", notes: "Remaining payment arranged.", receipt_no: "FD-1001", created_at: now },
    { id: "local-ar-2", student_id: "local-student-2", class_id: ids.classB1, teacher_id: ids.teacher2, received_by: ids.admin, amount: 8500, due_date: today, paid_at: now, status: "paid", notes: "Full payment received.", receipt_no: "FD-1002", created_at: now },
  ],
  exam_records: [
    { id: "local-exam-1", student_id: "local-student-1", exam_type: "placement", scheduled_at: now, level_result: "A2", score_percent: 78, result_comment: "Strong grammar, needs speaking confidence.", created_by: ids.admin, created_at: now },
    { id: "local-exam-2", student_id: "local-student-2", exam_type: "osd", scheduled_at: new Date(Date.now() + 7 * 86400000).toISOString(), level_result: "", score_percent: null, result_comment: "ÖSD booking pending confirmation.", created_by: ids.reception, created_at: now },
    ...Array.from({ length: 48 }, (_, index) => {
      const studentNumber = index + 3;
      const currentLevel = studentNumber <= 25 ? "A1" : "B1";
      const promoted = studentNumber % 3 !== 0;
      const nextLevel = currentLevel === "A1" ? "A2" : "B2";
      return {
        id: `local-exam-${studentNumber}`,
        student_id: `local-student-${studentNumber}`,
        exam_type: "placement",
        scheduled_at: new Date(Date.now() - index * 86400000).toISOString(),
        level_result: promoted ? nextLevel : currentLevel,
        score_percent: promoted ? 72 + (studentNumber % 20) : 55 + (studentNumber % 10),
        result_comment: promoted ? `Ready to continue to ${nextLevel}.` : "Needs more practice before moving up.",
        created_by: ids.admin,
        created_at: now,
      };
    }),
    ...Array.from({ length: 10 }, (_, index) => {
      const studentNumber = index + 1;
      const isMain = index % 2 === 0;
      return {
        id: `local-${isMain ? "main" : "quiz"}-${studentNumber}`,
        student_id: `local-student-${studentNumber}`,
        exam_type: isMain ? "main" : "quiz",
        scheduled_at: new Date(Date.now() - (index + 1) * 3600000).toISOString(),
        level_result: null,
        score_percent: isMain ? (index === 4 ? 48 : 76 + index) : 68 + index,
        result_comment: isMain ? (index === 4 ? "Needs another attempt." : "Passed main test.") : "Quiz result recorded.",
        booking_status: isMain && index !== 4 ? "booked" : "not_booked",
        booked_class_id: isMain && index !== 4 ? (index % 2 === 0 ? ids.classA1 : ids.classB1) : null,
        created_by: ids.admin,
        created_at: now,
      };
    }),
  ],
  feedback_records: [
    { id: "local-feedback-1", student_id: "local-student-1", teacher_id: ids.teacher, source: "teacher", rating: 4, comment: "Good attendance and homework discipline.", created_by: ids.teacherUser, created_at: now },
    { id: "local-feedback-2", student_id: "local-student-2", teacher_id: ids.teacher2, source: "student", rating: 5, comment: "Likes online class pace.", created_by: ids.reception, created_at: now },
  ],
  student_worker_feedback: [
    { id: "local-worker-feedback-1", student_id: "local-student-1", target_user_id: null, target_teacher_id: ids.teacher, target_role: "teacher", comment: "Teacher explained the speaking task clearly today.", created_at: now },
    { id: "local-worker-feedback-2", student_id: "local-student-2", target_user_id: ids.reception, target_teacher_id: null, target_role: "reception", comment: "Reception helped me reschedule politely.", created_at: now },
  ],
  employee_events: [
    { id: "local-event-1", user_id: ids.sales, teacher_id: null, type: "performance_note", event_date: today, amount: null, score: 86, notes: "Followed up with all hot leads.", created_by: ids.admin, created_at: now },
    { id: "local-event-2", user_id: null, teacher_id: ids.teacher, type: "vacation", event_date: today, amount: null, score: null, notes: "Approved half-day leave.", created_by: ids.admin, created_at: now },
  ],
  audit_logs: [
    { id: "local-log-1", actor_user_id: ids.admin, actor_name: "Admin", actor_email: "admin@local.test", action: "updated", entity_type: "student", entity_id: "local-student-1", details: { fields: ["amount_paid", "payment_comment"], note: "Demo student payment update" }, created_at: now },
    { id: "local-log-2", actor_user_id: ids.admin, actor_name: "Admin", actor_email: "admin@local.test", action: "created", entity_type: "class", entity_id: ids.classB2, details: { name: "B2 Weekend", status: "finished" }, created_at: now },
  ],
  textbook_inventory: [
    { id: "local-book-1", title: "Menschen A1 Kursbuch", level: "A1", edition: "2024", quantity_on_hand: 12, quantity_needed: 20, quantity_ordered: 8, ordered_at: today, expected_delivery_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), supplier: "Hueber", notes: "Delivery pending", created_at: now, updated_at: now },
    { id: "local-book-2", title: "Sicher! B1+ Arbeitsbuch", level: "B1", edition: "2023", quantity_on_hand: 18, quantity_needed: 18, quantity_ordered: 0, ordered_at: null, expected_delivery_date: null, supplier: "Hueber", notes: "Enough for current group", created_at: now, updated_at: now },
    { id: "local-book-3", title: "Aspekte neu B2", level: "B2", edition: "2024", quantity_on_hand: 3, quantity_needed: 15, quantity_ordered: 12, ordered_at: today, expected_delivery_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), supplier: "Klett", notes: "Priority order", created_at: now, updated_at: now },
  ],
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function withRelations(table: string, row: Row) {
  const item = { ...row };
  if (table === "classes") item.students = db.students.filter((student) => student.class_id === row.id);
  if (table === "student_account_records") {
    item.students = db.students.find((student) => student.id === row.student_id) ?? null;
    item.classes = db.classes.find((classRow) => classRow.id === row.class_id) ?? null;
    item.teachers = db.teachers.find((teacher) => teacher.id === row.teacher_id) ?? null;
    item.users = db.users.find((user) => user.id === row.received_by) ?? null;
  }
  if (table === "exam_records" || table === "feedback_records") {
    item.students = db.students.find((student) => student.id === row.student_id) ?? null;
    item.teachers = db.teachers.find((teacher) => teacher.id === row.teacher_id) ?? null;
  }
  if (table === "student_worker_feedback") {
    item.students = db.students.find((student) => student.id === row.student_id) ?? null;
    item.users = db.users.find((user) => user.id === row.target_user_id) ?? null;
    item.teachers = db.teachers.find((teacher) => teacher.id === row.target_teacher_id) ?? null;
  }
  if (table === "employee_events") {
    item.users = db.users.find((user) => user.id === row.user_id) ?? null;
    item.teachers = db.teachers.find((teacher) => teacher.id === row.teacher_id) ?? null;
  }
  if (table === "students") {
    const klass = db.classes.find((classRow) => classRow.id === row.class_id);
    item.classes = klass ? { ...klass, teachers: db.teachers.find((teacher) => teacher.id === klass.teacher_id) ?? null } : null;
  }
  if (table === "teacher_adjustments") item.teachers = db.teachers.find((teacher) => teacher.id === row.teacher_id) ?? null;
  if (table === "employee_adjustments") item.users = db.users.find((user) => user.id === row.user_id) ?? null;
  if (table === "leads") {
    item.lead_interactions = db.lead_interactions
      .filter((interaction) => interaction.lead_id === row.id)
      .map((interaction): Row => ({ ...interaction, users: db.users.find((user) => user.id === interaction.created_by) ?? null }))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    item.users = db.users.find((user) => user.id === row.assigned_to) ?? null;
    item.lead_files = db.lead_files.find((file) => file.id === row.file_id) ?? null;
  }
  return item;
}

class LocalQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private filterSpecs: Array<{ type: "eq" | "neq" | "in" | "gte" | "lte"; key: string; value: unknown }> = [];
  private sortKey: string | null = null;
  private ascending = true;
  private singleRow = false;
  private head = false;
  private wantsCount = false;
  private operation: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row | Row[] | null = null;

  constructor(private table: string) {}

  select(_columns = "*", options?: { count?: string; head?: boolean }) {
    this.head = Boolean(options?.head);
    this.wantsCount = Boolean(options?.count);
    return this;
  }

  insert(payload: Row | Row[]) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  upsert(payload: Row | Row[]) {
    this.operation = "upsert";
    this.payload = payload;
    return this;
  }

  update(payload: Row) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(key: string, value: unknown) {
    this.filters.push((row) => row[key] === value);
    this.filterSpecs.push({ type: "eq", key, value });
    return this;
  }

  neq(key: string, value: unknown) {
    this.filters.push((row) => row[key] !== value);
    this.filterSpecs.push({ type: "neq", key, value });
    return this;
  }

  in(key: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[key]));
    this.filterSpecs.push({ type: "in", key, value: values });
    return this;
  }

  gte(key: string, value: string) {
    this.filters.push((row) => String(row[key] ?? "") >= value);
    this.filterSpecs.push({ type: "gte", key, value });
    return this;
  }

  lte(key: string, value: string) {
    this.filters.push((row) => String(row[key] ?? "") <= value);
    this.filterSpecs.push({ type: "lte", key, value });
    return this;
  }

  order(key: string, options?: { ascending?: boolean }) {
    this.sortKey = key;
    this.ascending = options?.ascending ?? true;
    return this;
  }

  async single() {
    this.singleRow = true;
    return this.resolve();
  }

  async maybeSingle() {
    this.singleRow = true;
    return this.resolve();
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.resolve().then(onfulfilled, onrejected);
  }

  private matching() {
    let rows = db[this.table] ?? [];
    for (const filter of this.filters) rows = rows.filter(filter);
    if (this.sortKey) {
      rows = [...rows].sort((a, b) => String(a[this.sortKey!] ?? "").localeCompare(String(b[this.sortKey!] ?? "")));
      if (!this.ascending) rows.reverse();
    }
    return rows;
  }

  private async resolve(): Promise<Result> {
    if (typeof window !== "undefined") {
      const response = await fetch("/api/local-db", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          table: this.table,
          operation: this.operation,
          payload: this.payload,
          filters: this.filterSpecs,
          sortKey: this.sortKey,
          ascending: this.ascending,
          singleRow: this.singleRow,
          head: this.head,
          wantsCount: this.wantsCount,
        }),
      });
      if (!response.ok) return { data: null, error: { message: "Local data request failed" } } as unknown as Result;
      return response.json() as Promise<Result>;
    }
    db[this.table] ??= [];
    if (this.operation === "insert" || this.operation === "upsert") {
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]).filter(Boolean).map((row) => ({
        id: row!.id ?? crypto.randomUUID(),
        created_at: row!.created_at ?? now,
        ...row,
      }));
      db[this.table].push(...rows);
      const data = this.singleRow ? withRelations(this.table, rows[0]) : rows.map((row) => withRelations(this.table, row));
      return { data: clone(data), error: null, count: rows.length };
    }
    if (this.operation === "update") {
      const rows = this.matching();
      rows.forEach((row) => Object.assign(row, this.payload));
      const data = this.singleRow ? rows[0] ?? null : rows;
      return { data: clone(data), error: null, count: rows.length };
    }
    if (this.operation === "delete") {
      const rows = this.matching();
      db[this.table] = db[this.table].filter((row) => !rows.includes(row));
      const data = this.singleRow ? rows[0] ?? null : rows;
      return { data: clone(data), error: null, count: rows.length };
    }
    const rows = this.matching().map((row) => withRelations(this.table, row));
    const data = this.head ? null : this.singleRow ? rows[0] ?? null : rows;
    return { data: clone(data), error: null, count: this.wantsCount ? rows.length : null };
  }
}

export function createLocalSupabaseClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: ids.admin, email: "admin@local.test" } }, error: null }),
      signInWithPassword: async () => ({ data: { user: { id: ids.admin, email: "admin@local.test" } }, error: null }),
      signOut: async () => ({ error: null }),
      admin: {
        createUser: async ({ email }: { email: string }) => ({ data: { user: { id: crypto.randomUUID(), email } }, error: null }),
        updateUserById: async (id: string) => ({ data: { user: { id, email: "local-reset@local.test" } }, error: null }),
      },
    },
    from: (table: string) => new LocalQuery(table),
  };
}

export function localProfile(role: Role = "admin", userId?: string): UserProfile {
  const byRole = db.users.find((user) => user.id === userId && user.role === role) ?? db.users.find((user) => user.role === role) ?? db.users[0];
  return clone(byRole as UserProfile);
}

export const localUser = { id: ids.admin, email: "admin@local.test" };
