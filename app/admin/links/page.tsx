import { randomUUID } from "node:crypto";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { qrDataUrl } from "@/lib/qr";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://www.fliessendeutsch.com";
}

function slug(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "profile";
}

async function ensureToken(supabase: any, table: "students" | "teachers", id: string, token: string | null | undefined) {
  if (token) return token;
  const generated = randomUUID().replaceAll("-", "");
  await supabase.from(table).update({ portal_token: generated }).eq("id", id);
  return generated;
}

export default async function LinksPage() {
  const { supabase } = await getCurrentUser("admin");
  const [students, teachers] = await Promise.all([
    supabase.from("students").select("id,full_name,phone,portal_token").order("full_name"),
    supabase.from("teachers").select("id,name,phone,portal_token").order("name"),
  ]);
  const studentLinks = await Promise.all((students.data ?? []).slice(0, 30).map(async (student) => {
    const token = await ensureToken(supabase, "students", student.id, student.portal_token);
    const url = `${siteUrl()}/attendance/student/${slug(student.full_name)}-${token}`;
    return { ...student, url, qr: await qrDataUrl(url) };
  }));
  const teacherLinks = await Promise.all((teachers.data ?? []).slice(0, 30).map(async (teacher) => {
    const token = await ensureToken(supabase, "teachers", teacher.id, teacher.portal_token);
    const url = `${siteUrl()}/portal/teacher/${slug(teacher.name)}-${token}`;
    return { ...teacher, url, qr: await qrDataUrl(url) };
  }));
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Student links and QR codes</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {studentLinks.map((student) => (
            <div key={student.id} className="rounded-lg border p-4">
              <Image src={student.qr} alt={`${student.full_name} QR`} width={132} height={132} unoptimized />
              <h3 className="mt-2 font-semibold">{student.full_name}</h3>
              <p className="break-all text-xs text-muted-foreground">{student.url}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Teacher links and QR codes</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {teacherLinks.map((teacher) => (
            <div key={teacher.id} className="rounded-lg border p-4">
              <Image src={teacher.qr} alt={`${teacher.name} QR`} width={132} height={132} unoptimized />
              <h3 className="mt-2 font-semibold">{teacher.name}</h3>
              <p className="break-all text-xs text-muted-foreground">{teacher.url}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
