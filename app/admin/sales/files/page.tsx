import { LeadImporter } from "@/components/forms/lead-importer";
import { DataTable } from "@/components/tables/data-table";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminSalesFilesPage() {
  const { supabase } = await getCurrentUser("admin");
  const [reps, files] = await Promise.all([
    supabase.from("users").select("id,full_name").eq("role", "sales").eq("is_active", true),
    supabase.from("lead_files").select("id,name,upload_date,total_leads").order("upload_date", { ascending: false }),
  ]);
  return <div className="space-y-6"><LeadImporter reps={reps.data ?? []} /><DataTable rows={(files.data ?? []) as unknown as Record<string, unknown>[]} columns={[{ key: "name", header: "File" }, { key: "upload_date", header: "Uploaded" }, { key: "total_leads", header: "Total" }]} /></div>;
}
