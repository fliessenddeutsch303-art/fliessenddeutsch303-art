"use client";

import { useEffect } from "react";

// the browser's print dialog saves the page as a PDF ("Save as PDF")
export function PrintActions({ label, back, backLabel, autoPrint }: { label: string; back: string; backLabel: string; autoPrint: boolean }) {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);
  return (
    <div className="mb-6 flex flex-wrap gap-2 print:hidden">
      <button type="button" onClick={() => window.print()} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white">{label}</button>
      <a href={back} className="rounded-md border px-4 py-2 text-sm font-semibold">{backLabel}</a>
    </div>
  );
}
