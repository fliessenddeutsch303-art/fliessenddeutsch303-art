import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { Logo } from "@/components/layout/logo";
import { ReminderNotifier } from "@/components/layout/reminder-notifier";
import { PersistentNavGroup } from "@/components/layout/persistent-nav-group";
import { ActiveNavLink } from "@/components/layout/active-nav-link";
import { PageHeaderContext } from "@/components/layout/page-header-context";
import { dictionaries, direction, type Lang } from "@/lib/i18n";
import type { NavItem, UserProfile } from "@/lib/types";

const nav: Record<string, Array<NavItem & { labelKey: keyof typeof dictionaries.en.nav }>> = {
  admin: [
    { href: "/admin/dashboard", label: "Dashboard", labelKey: "dashboard" },
    { href: "/admin/students", label: "Students", labelKey: "students" },
    { href: "/admin/classes", label: "Classes", labelKey: "classes" },
    { href: "/admin/student-attendance", label: "Student Attendance", labelKey: "studentAttendance" },
    { href: "/admin/exams", label: "Student Follow Up", labelKey: "exams" },
    { href: "/admin/teacher-follow-up", label: "Teacher Student Follow Up", labelKey: "teacherFollowUp" },
    { href: "/admin/exams-management", label: "Exams", labelKey: "examManagement" },
    { href: "/admin/textbooks", label: "Textbook inventory", labelKey: "textbookInventory" },
    { href: "/admin/hr/attendance", label: "HR", labelKey: "hr" },
    { href: "/admin/hr/performance", label: "HR Performance", labelKey: "performance" },
    { href: "/admin/account-center", label: "Account Center", labelKey: "accountCenter" },
    { href: "/admin/logs", label: "Logs", labelKey: "logs" },
    { href: "/admin/sales", label: "Sales", labelKey: "sales" },
    { href: "/admin/sales/lists", label: "Manual lists", labelKey: "manualLists" },
    { href: "/admin/treasury", label: "Treasury", labelKey: "treasury" },
    { href: "/admin/reports", label: "Reports", labelKey: "reports" },
    { href: "/admin/branches", label: "Branches", labelKey: "branches" },
  ],
  reception: [
    { href: "/reception/attendance/students", label: "Student Attendance", labelKey: "studentAttendance" },
    { href: "/reception/students", label: "Students", labelKey: "students" },
    { href: "/reception/treasury", label: "Treasury Entry", labelKey: "treasury" },
  ],
  sales: [
    { href: "/sales/leads", label: "My Leads", labelKey: "myLeads" },
    { href: "/sales/lists", label: "Manual lists", labelKey: "manualLists" },
    { href: "/sales/files", label: "Files", labelKey: "files" },
  ],
  teacher: [
    { href: "/teacher/follow-up", label: "Teacher Student Follow Up", labelKey: "teacherFollowUp" },
  ],
};

export function AppShell({ profile, children, lang }: { profile: UserProfile; children: React.ReactNode; lang: Lang }) {
  const t = dictionaries[lang];
  const isRtl = direction(lang) === "rtl";
  const visibleNav = nav[profile.role] ?? nav.admin;
  const uniqueNav = visibleNav.filter((item, index, items) => items.findIndex((candidate) => candidate.href === item.href) === index);
  const adminGroups = [
    { label: t.nav.studentsGroup, items: uniqueNav.filter((item) => ["/admin/students", "/admin/classes", "/admin/student-attendance", "/admin/exams", "/admin/teacher-follow-up", "/admin/exams-management"].includes(item.href)) },
    { label: t.nav.staffGroup, items: uniqueNav.filter((item) => item.href.startsWith("/admin/hr")) },
    { label: t.nav.salesGroup, items: uniqueNav.filter((item) => item.href.includes("sales") || item.href.includes("/sales/")) },
    { label: t.nav.financeGroup, items: uniqueNav.filter((item) => ["/admin/treasury", "/admin/reports", "/admin/textbooks"].includes(item.href)) },
    { label: t.nav.systemGroup, items: uniqueNav.filter((item) => !["/admin/students", "/admin/classes", "/admin/student-attendance", "/admin/exams", "/admin/teacher-follow-up", "/admin/exams-management", "/admin/treasury", "/admin/reports", "/admin/textbooks"].includes(item.href) && !item.href.startsWith("/admin/hr") && !item.href.includes("sales") && !item.href.includes("/sales/") && !item.href.startsWith("/teacher/") && !item.href.startsWith("/reception/")) },
  ].filter((group) => group.items.length);
  const navGroups = profile.role === "admin" ? adminGroups : [{ label: "", items: uniqueNav }];
  return (
    <div className="min-h-screen bg-[#FCFAF6]">
      <aside className={`fixed inset-y-0 hidden w-64 bg-white p-5 md:block ${isRtl ? "right-0 border-l" : "left-0 border-r"}`}>
        <div className="flex items-center gap-3 font-semibold text-primary">
          <Logo className="h-12 w-auto object-contain" />
        </div>
        <nav className="mt-8 grid gap-4" aria-label={t.academySystem}>
          {navGroups.map((group) => group.label ? <PersistentNavGroup key={group.label} groupKey={`group-${group.items[0]?.href}`} label={group.label} rtl={isRtl} items={group.items.map((item) => ({ href: item.href, label: t.nav[item.labelKey] }))} /> : group.items.map((item) => <ActiveNavLink key={item.href} href={item.href} label={t.nav[item.labelKey]} rtl={isRtl} />))}
        </nav>
        <form action="/api/auth/signout" className="absolute bottom-5 left-5 right-5">
          <Button className="w-full" variant="outline">
            <LogOut size={16} /> {t.signOut}
          </Button>
        </form>
      </aside>
      <main className={`min-w-0 ${isRtl ? "md:pr-64" : "md:pl-64"}`}>
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b bg-white/95 px-3 backdrop-blur sm:px-4 md:px-8">
          <PageHeaderContext profile={profile} lang={lang} />
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <LanguageToggle lang={lang} />
            <div className="hidden text-sm font-medium text-primary sm:block">{t.academySystem}</div>
          </div>
        </header>
        <div className="border-b bg-white px-3 py-2 md:hidden">
          <details>
            <summary className="cursor-pointer list-none rounded-md border px-3 py-2 text-sm font-semibold text-primary">{lang === "ar" ? "القائمة" : "Menu"}</summary>
            <nav className="mt-2 grid gap-3" aria-label={t.academySystem}>
              {navGroups.map((group) => group.label ? <PersistentNavGroup key={group.label} groupKey={`group-${group.items[0]?.href}`} label={group.label} mobile items={group.items.map((item) => ({ href: item.href, label: t.nav[item.labelKey] }))} /> : group.items.map((item) => <ActiveNavLink key={item.href} href={item.href} label={t.nav[item.labelKey]} mobile />))}
            </nav>
            <form action="/api/auth/signout" className="mt-2">
              <Button className="w-full" variant="outline"><LogOut size={16} /> {t.signOut}</Button>
            </form>
          </details>
        </div>
        <div className="min-w-0 p-3 sm:p-4 md:p-8">{children}</div>
      </main>
      <ReminderNotifier />
    </div>
  );
}
