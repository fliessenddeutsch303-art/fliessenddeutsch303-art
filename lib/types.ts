export type Role = "admin" | "reception" | "sales" | "teacher";
export type Permissions = {
  sales_access?: boolean;
  assigned_files?: string[];
  can_view_treasury?: boolean;
  can_view_payroll?: boolean;
};
export type UserProfile = {
  id: string;
  full_name: string;
  email?: string;
  role: Role;
  is_active: boolean;
  permissions: Permissions | null;
  payroll_type?: "monthly_salary" | "monthly_wage" | "hourly" | "per_session";
  monthly_salary?: number;
  monthly_wage?: number;
  hourly_rate?: number;
};
export type NavItem = { href: string; label: string };
