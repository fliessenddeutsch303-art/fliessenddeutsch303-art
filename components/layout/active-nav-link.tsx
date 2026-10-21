"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function ActiveNavLink({ href, label, rtl = false, mobile = false }: { href: string; label: string; rtl?: boolean; mobile?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const prefetch = () => { if (!active) void router.prefetch(href); };
  return <Link href={href} prefetch={false} onMouseEnter={prefetch} onFocus={prefetch} className={`${mobile ? "rounded-md px-3 py-2.5 text-base hover:bg-muted" : "rounded-md border px-3 py-2.5 text-base font-medium transition-colors hover:bg-muted"} ${active ? "border-[#D4AF37] bg-[#FFFCF2] text-[#1A1A1A] shadow-[inset_0_0_0_1px_rgba(212,175,55,0.25)]" : "border-transparent text-[#1A1A1A]"} ${rtl && !mobile ? "text-right" : !mobile ? "text-left" : ""}`} aria-current={active ? "page" : undefined}>{label}</Link>;
}
