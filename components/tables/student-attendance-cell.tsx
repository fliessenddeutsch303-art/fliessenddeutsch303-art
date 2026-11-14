"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";

function slug(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "profile";
}

export function StudentAttendanceCell({ studentName, portalToken }: { studentName: string; portalToken?: string | null }) {
  const [qr, setQr] = useState("");
  const [qrError, setQrError] = useState(false);
  const path = useMemo(() => (portalToken ? `/attendance/student/${slug(studentName)}-${portalToken}` : ""), [studentName, portalToken]);

  if (!path) return <span className="text-xs text-muted-foreground">No link yet</span>;
  const fullUrl = () => `${window.location.origin}${path}`;

  async function showQr() {
    setQrError(false);
    try {
      setQr(await QRCode.toDataURL(fullUrl(), { margin: 1, scale: 3, color: { dark: "#111111", light: "#FFFFFF" } }));
    } catch {
      setQrError(true);
    }
  }

  return (
    <div className="flex min-w-40 items-center gap-2">
      {qr ? <Image src={qr} alt="Student attendance QR" width={54} height={54} unoptimized /> : null}
      <div className="grid gap-1">
        {!qr && <Button type="button" size="sm" variant="outline" onClick={() => void showQr()}>Show QR</Button>}
        {qrError && <span className="text-xs text-red-700">QR failed</span>}
        <Button asChild size="sm" variant="outline">
          <a href={path}>Check in</a>
        </Button>
        <button type="button" className="text-left text-xs text-muted-foreground hover:text-primary" onClick={() => void navigator.clipboard.writeText(fullUrl())}>
          Copy link
        </button>
      </div>
    </div>
  );
}
