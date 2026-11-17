import { BranchForm } from "@/components/forms/client-addition-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/tables/data-table";
import { getCurrentUser } from "@/lib/auth";

export default async function BranchesPage() {
  const { supabase } = await getCurrentUser("admin");
  const { data } = await supabase.from("branches").select("*").order("created_at", { ascending: false });
  const rows = (data ?? []).map((branch) => ({
    id: branch.id,
    name: branch.name,
    address: branch.address ?? "",
    phone: branch.phone ?? "",
    status: branch.is_active ? "Active" : "Inactive",
    _edit: { name: branch.name, address: branch.address, phone: branch.phone, is_active: branch.is_active },
  }));
  return (
    <div className="space-y-6">
      <BranchForm />
      <Card>
        <CardHeader><CardTitle>Branches</CardTitle></CardHeader>
        <CardContent><DataTable rows={rows} columns={[{ key: "name", header: "Branch" }, { key: "address", header: "Address" }, { key: "phone", header: "Phone" }, { key: "status", header: "Status" }]} edit={{ table: "branches", canDelete: true, fields: [{ key: "name", label: "Branch", required: true }, { key: "address", label: "Address" }, { key: "phone", label: "Phone" }, { key: "is_active", label: "Active", type: "boolean" }] }} /></CardContent>
      </Card>
    </div>
  );
}
