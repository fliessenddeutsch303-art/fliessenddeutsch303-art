"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { Logo } from "@/components/layout/logo";
import { dictionaries, type Lang } from "@/lib/i18n";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/env";

const roleHome = { admin: "/admin/dashboard", reception: "/reception/attendance/students", sales: "/sales/leads", teacher: "/teacher/attendance" } as const;

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [lang] = useState<Lang>(() => {
    if (typeof document === "undefined") return "en";
    return document.cookie.includes("fd_lang=ar") ? "ar" : "en";
  });
  const t = dictionaries[lang];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(search.get("deactivated") ? t.deactivated : "");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    if (!hasSupabaseEnv()) {
      const localAccounts = JSON.parse(localStorage.getItem("fd_local_accounts") ?? "[]") as Array<{ id: string; email: string; password: string; role: keyof typeof roleHome; full_name: string; is_active: boolean }>;
      const localAccount = localAccounts.find((account) => account.email.toLowerCase() === email.trim().toLowerCase() && account.password === password);
      if (localAccount && localAccount.is_active) {
        document.cookie = `fd_local_user_id=${encodeURIComponent(localAccount.id)}; path=/`;
        document.cookie = `fd_local_user_email=${encodeURIComponent(localAccount.email)}; path=/`;
        document.cookie = `fd_local_role=${encodeURIComponent(localAccount.role)}; path=/`;
        router.replace(roleHome[localAccount.role]);
        return;
      }
      const response = await fetch("/api/local-login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? t.loginFailed);
        setLoading(false);
        return;
      }
      router.replace(roleHome[result.role as keyof typeof roleHome]);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !data.user) {
      setError(signInError?.message ?? t.loginFailed);
      setLoading(false);
      return;
    }
    if (!remember) localStorage.setItem("fd_session_preference", "session");
    const { data: profile } = await supabase.from("users").select("role,is_active").eq("id", data.user.id).single();
    if (!profile?.is_active) {
      await supabase.auth.signOut();
      setError(t.deactivated);
      setLoading(false);
      return;
    }
    const sessionKey = crypto.randomUUID();
    const lockResponse = await fetch("/api/session-lock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ session_key: sessionKey }) });
    if (!lockResponse.ok) {
      await supabase.auth.signOut();
      const lockResult = await lockResponse.json().catch(() => null);
      setError(lockResult?.error ?? t.loginFailed);
      setLoading(false);
      return;
    }
    document.cookie = `fd_session_key=${encodeURIComponent(sessionKey)}; path=/; max-age=86400; samesite=lax`;
    router.replace(roleHome[profile.role as keyof typeof roleHome]);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FCFAF6] p-4">
      <div className="absolute end-4 top-4">
        <LanguageToggle lang={lang} />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <Logo className="mb-4 h-24 w-auto object-contain" />
          <CardTitle className="text-2xl">Fließend Deutsch</CardTitle>
          <CardDescription>{t.signInDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <Input required type="email" placeholder={t.emailAddress} value={email} onChange={(event) => setEmail(event.target.value)} />
            <Input required type="password" placeholder={t.password} value={password} onChange={(event) => setPassword(event.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <input checked={remember} type="checkbox" onChange={(event) => setRemember(event.target.checked)} />
              {t.rememberMe}
            </label>
            {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <Button className="w-full" disabled={loading}>{loading ? t.signingIn : t.signIn}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[#FCFAF6] p-4">{dictionaries.en.loading}</main>}>
      <LoginForm />
    </Suspense>
  );
}
