import { randomUUID } from "node:crypto";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { qrDataUrl } from "@/lib/qr";
import { fetchAll } from "@/lib/supabase/fetch-all";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://www.fliessendeutsch.com";
}

function slug(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "profile";
}

async function ensureToken(supabase: any, table: "students" | "teachers", id: string, token: string | null | undefined): Promise<string | { error: string }> {
  if (token) return token;
  const generated = randomUUID().replaceAll("-", "");
  const { error } = await supabase.from(table).update({ portal_token: generated }).eq("id", id);
  if (error) return { error: error.message as string };
  return generated;
}

export default async function LinksPage() {
  const { supabase } = await getCurrentUser("admin");
  const [students, teachers] = await Promise.all([
    fetchAll((from, to) => supabase.from("students").select("id,full_name,phone,portal_token").order("full_name").order("id").range(from, to)),
    fetchAll((from, to) => supabase.from("teachers").select("id,name,phone,portal_token").order("name").order("id").range(from, to)),
  ]);
  const studentLinks = await Promise.all((students.data ?? []).map(async (student) => {
    const token = await ensureToken(supabase, "students", student.id, student.portal_token);
    if (typeof token !== "string") return { ...student, url: "", qr: "", error: token.error };
    const url = `${siteUrl()}/attendance/student/${slug(student.full_name)}-${token}`;
    return { ...student, url, qr: await qrDataUrl(url), error: "" };
  }));
  const teacherLinks = await Promise.all((teachers.data ?? []).map(async (teacher) => {
    const token = await ensureToken(supabase, "teachers", teacher.id, teacher.portal_token);
    if (typeof token !== "string") return { ...teacher, url: "", qr: "", error: token.error };
    const url = `${siteUrl()}/portal/teacher/${slug(teacher.name)}-${token}`;
    return { ...teacher, url, qr: await qrDataUrl(url), error: "" };
  }));
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Student links and QR codes ({studentLinks.length})</CardTitle>{students.error && <p className="text-sm text-red-700">Could not load student links: {students.error.message}</p>}<p className="text-sm text-muted-foreground">Students scan their code and tap &quot;I am here&quot; to register attendance.</p></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {studentLinks.map((student) => (
            <div key={student.id} className="rounded-lg border p-4">
              {student.qr ? <Image src={student.qr} alt={`${student.full_name} QR`} width={132} height={132} unoptimized /> : null}
              <h3 className="mt-2 font-semibold">{student.full_name}</h3>
              {student.error ? <p className="text-xs text-red-700">Could not create a link: {student.error}</p> : <p className="break-all text-xs text-muted-foreground">{student.url}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Teacher portal links and QR codes ({teacherLinks.length})</CardTitle>{teachers.error && <p className="text-sm text-red-700">Could not load teacher links: {teachers.error.message}</p>}<p className="text-sm text-muted-foreground">These open the teacher&apos;s read-only portal. They do not check the teacher in.</p></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {teacherLinks.map((teacher) => (
            <div key={teacher.id} className="rounded-lg border p-4">
              {teacher.qr ? <Image src={teacher.qr} alt={`${teacher.name} portal QR`} width={132} height={132} unoptimized /> : null}
              <h3 className="mt-2 font-semibold">{teacher.name}</h3>
              {teacher.error ? <p className="text-xs text-red-700">Could not create a link: {teacher.error}</p> : <p className="break-all text-xs text-muted-foreground">{teacher.url}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
