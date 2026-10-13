"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { dictionaries, type Lang } from "@/lib/i18n";
import type { UserProfile } from "@/lib/types";

const paths = [
  ["/admin/dashboard", "dashboard"], ["/admin/students", "students"], ["/admin/classes", "classes"],
  ["/admin/student-attendance", "studentAttendance"], ["/admin/exams-management", "examManagement"], ["/admin/exams", "exams"],
  ["/admin/teacher-follow-up", "teacherFollowUp"], ["/admin/textbooks", "textbookInventory"], ["/admin/hr/attendance", "hr"],
  ["/admin/hr/performance", "performance"], ["/admin/account-center", "accountCenter"], ["/admin/logs", "logs"],
  ["/admin/sales", "sales"], ["/admin/treasury", "treasury"], ["/admin/reports", "reports"], ["/admin/branches", "branches"],
  ["/reception/attendance/students", "studentAttendance"], ["/reception/students", "students"], ["/reception/treasury", "treasury"],
  ["/sales/leads", "myLeads"], ["/sales/lists", "manualLists"], ["/sales/files", "files"], ["/teacher/follow-up", "teacherFollowUp"],
] as const;

export function PageHeaderContext({ profile, lang }: { profile: UserProfile; lang: Lang }) {
  const pathname = usePathname();
  const t = dictionaries[lang];
  // Keep the first render identical on the server and browser. The browser
  // fills the clock after hydration so the timestamp cannot cause a mismatch.
  const [now, setNow] = useState<Date | null>(null);
  const title = useMemo(() => {
    const match = paths.find(([path]) => pathname === path || pathname.startsWith(`${path}/`));
    return match ? t.nav[match[1] as keyof typeof t.nav] : t.academySystem;
  }, [pathname, t]);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  return <div className="min-w-0">
    <p className="truncate text-sm font-semibold text-[#1A1A1A]">{title}</p>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground sm:text-sm">
      <span>{profile.full_name}</span>
      <span aria-hidden="true">·</span>
      <time dateTime={now?.toISOString()}>{now ? now.toLocaleString(lang === "ar" ? "ar-EG" : undefined, { dateStyle: "medium", timeStyle: "short" }) : "—"}</time>
    </div>
  </div>;
}
