"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Item = { href: string; label: string };

export function PersistentNavGroup({ groupKey, label, items, rtl = false, mobile = false }: { groupKey: string; label: string; items: Item[]; rtl?: boolean; mobile?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const storageKey = `fd_sidebar_group_v2_${groupKey}`;
  const [open, setOpen] = useState(false);
  const activeGroup = items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) setOpen(saved === "true");
  }, [storageKey]);

  function toggle() {
    setOpen((current) => {
      const next = !current;
      localStorage.setItem(storageKey, String(next));
      return next;
    });
  }

  return <details open={open} className="group">
    <summary onClick={(event) => { event.preventDefault(); toggle(); }} className={`cursor-pointer list-none rounded-md border px-3 py-2.5 text-sm font-semibold tracking-wide transition-colors after:float-right after:content-['+'] group-open:after:content-['−'] ${activeGroup ? "border-[#D4AF37] bg-[#FFFCF2] text-[#1A1A1A] shadow-[inset_0_0_0_1px_rgba(212,175,55,0.25)]" : "border-transparent text-muted-foreground hover:border-[#D4AF37]/60 hover:bg-[#FFFCF2]"}`}>{label}</summary>
    <div className="mt-1 grid gap-1">{items.map((item) => { const active = pathname === item.href || pathname.startsWith(`${item.href}/`); const prefetch = () => { if (!active) void router.prefetch(item.href); }; return <Link key={item.href} prefetch={false} onMouseEnter={prefetch} onFocus={prefetch} className={`${mobile ? "rounded-md px-3 py-2.5 text-base hover:bg-muted" : "rounded-md border px-3 py-2.5 text-base font-medium transition-colors hover:bg-muted"} ${active ? "border-[#D4AF37] bg-[#FFFCF2] text-[#1A1A1A] shadow-[inset_0_0_0_1px_rgba(212,175,55,0.25)]" : "border-transparent text-[#1A1A1A]"} ${rtl && !mobile ? "text-right" : !mobile ? "text-left" : ""}`} href={item.href} aria-current={active ? "page" : undefined}>{item.label}</Link>; })}</div>
  </details>;
}
