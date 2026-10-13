"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type WorkerOption = { value: string; label: string };

export function StudentWorkerCommentForm({ studentToken, workers }: { studentToken: string; workers: WorkerOption[] }) {
  const [target, setTarget] = useState(workers[0]?.value ?? "");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/student-worker-feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ student_token: studentToken, target, comment }),
    });
    const json = await response.json();
    if (!response.ok) {
      setMessage(json.error ?? "Could not save feedback");
      return;
    }
    setComment("");
    setMessage("Thank you. Your comment was sent to administration.");
  }

  if (!workers.length) return null;

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border bg-white p-4 text-left">
      <div>
        <p className="font-semibold">Leave a comment for administration</p>
        <p className="text-xs text-muted-foreground">Only admins can see this. It will not print on payslips.</p>
      </div>
      <Select value={target} onChange={(event) => setTarget(event.target.value)} aria-label="Worker">
        {workers.map((worker) => <option key={worker.value} value={worker.value}>{worker.label}</option>)}
      </Select>
      <Textarea required minLength={3} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Write your comment about the teacher or receptionist..." />
      <Button className="w-full" disabled={!target || !comment.trim()}>Send Comment</Button>
      {message && <p className="text-center text-sm text-muted-foreground">{message}</p>}
    </form>
  );
}
