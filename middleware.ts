import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hasSupabaseEnv } from "@/lib/env";
import type { Role } from "@/lib/types";

const protectedPrefixes = ["/admin", "/reception", "/sales", "/teacher"];
const rolePrefixes: Record<Role, string> = {
  admin: "/admin",
  reception: "/reception",
  sales: "/sales",
  teacher: "/teacher",
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;

  if (!hasSupabaseEnv()) {
    if (path === "/") return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    return response;
  }

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: auth } = await supabase.auth.getUser();

  if (path === "/") {
    return NextResponse.redirect(new URL(auth.user ? "/admin/dashboard" : "/login", request.url));
  }
  if (!protectedPrefixes.some((prefix) => path.startsWith(prefix))) return response;
  if (!auth.user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: profile } = await supabase.from("users").select("role,is_active").eq("id", auth.user.id).single();
  if (!profile?.is_active) return NextResponse.redirect(new URL("/login?deactivated=1", request.url));

  const role = profile.role as Role;
  const sessionKey = request.cookies.get("fd_session_key")?.value;
  const { data: activeSession } = await supabase.from("account_active_sessions").select("id").eq("user_id", auth.user.id).eq("session_key", sessionKey ?? "").maybeSingle();
  if (!sessionKey || !activeSession) return NextResponse.redirect(new URL("/login?session=conflict", request.url));
  if (path.startsWith("/admin/treasury") && role !== "admin") return new NextResponse("Unauthorized", { status: 401 });
  if (!path.startsWith(rolePrefixes[role]) && role !== "admin") {
    return NextResponse.redirect(new URL(rolePrefixes[role], request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|workbox-|manifest.json).*)"],
};
