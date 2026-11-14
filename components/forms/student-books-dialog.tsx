"use client";

import { useRef, useState } from "react";
import { BookOpen, Edit2, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { academyDate } from "@/lib/dates";
import { formatMoney } from "@/lib/utils";

export type StudentBook = {
  id: string;
  student_id: string;
  textbook_id?: string | null;
  title: string;
  received_at: string;
  price: number;
  payment_status: "paid" | "unpaid" | "arranged";
  payment_due_date?: string | null;
  paid_at?: string | null;
  notes?: string | null;
};
export type TextbookOption = { id: string; title: string; level?: string | null; quantity_on_hand?: number | null };

const OTHER = "__other";
const blank = () => ({ source: "", title: "", received_at: academyDate(), price: "0", payment_status: "unpaid" as StudentBook["payment_status"], payment_due_date: "", notes: "" });

export function BookStatusBadge({ book }: { book: StudentBook }) {
  if (book.payment_status === "paid") return <Badge className="border-green-200 bg-green-50 text-green-700">Paid</Badge>;
  if (book.payment_status === "arranged" && book.payment_due_date) {
    const overdue = book.payment_due_date < academyDate();
    return <Badge className={overdue ? "border-brand-red bg-red-50 text-brand-red" : "border-amber-200 bg-amber-50 text-amber-700"}>{overdue ? "Overdue" : "Will pay on"} {book.payment_due_date}</Badge>;
  }
  return <Badge className="border-brand-red bg-red-50 text-brand-red">Unpaid</Badge>;
}

export function bookSummary(book: StudentBook) {
  const status = book.payment_status === "paid" ? "Paid" : book.payment_status === "arranged" ? `Will pay on ${book.payment_due_date ?? ""}` : "Unpaid";
  return `${book.title} (${book.received_at}, ${status})`;
}

export function StudentBooksDialog({ student, books, textbooks: stock, onClose, onChange, onStockChange }: { student: { id: string; full_name: string }; books: StudentBook[]; textbooks: TextbookOption[]; onClose: () => void; onChange: (books: StudentBook[]) => void; onStockChange: (textbooks: TextbookOption[]) => void }) {
  const [editing, setEditing] = useState<StudentBook | null>(null);
  const [form, setForm] = useState(blank);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const clientRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  const db = () => (clientRef.current ??= createSupabaseBrowserClient());
  const setField = <K extends keyof ReturnType<typeof blank>>(key: K, value: ReturnType<typeof blank>[K]) => setForm((current) => ({ ...current, [key]: value }));
  const chosen = stock.find((book) => book.id === form.source);

  function startEdit(book: StudentBook) {
    setEditing(book);
    setMessage("");
    setForm({ source: book.textbook_id && stock.some((item) => item.id === book.textbook_id) ? book.textbook_id : OTHER, title: book.title, received_at: book.received_at, price: String(book.price ?? 0), payment_status: book.payment_status, payment_due_date: book.payment_due_date ?? "", notes: book.notes ?? "" });
  }

  function reset() {
    setEditing(null);
    setForm(blank());
  }

  function adjustStock(textbookId: string | null | undefined, delta: number) {
    if (!textbookId) return;
    onStockChange(stock.map((item) => item.id === textbookId ? { ...item, quantity_on_hand: Math.max(0, Number(item.quantity_on_hand ?? 0) + delta) } : item));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const title = (chosen?.title ?? form.title).trim();
    if (!form.source) return setMessage("Choose a book.");
    if (!title) return setMessage("Type the book title.");
    if (!form.received_at) return setMessage("Choose the date the book was received.");
    if (form.payment_status === "arranged" && !form.payment_due_date) return setMessage("Choose the date the student will pay.");
    const price = Number(form.price || 0);
    if (!Number.isFinite(price) || price < 0) return setMessage("The price must be 0 or more.");
    const payload = {
      student_id: student.id,
      textbook_id: chosen?.id ?? null,
      title,
      received_at: form.received_at,
      price,
      payment_status: form.payment_status,
      payment_due_date: form.payment_status === "arranged" ? form.payment_due_date : null,
      paid_at: form.payment_status === "paid" ? (editing?.payment_status === "paid" ? editing.paid_at ?? academyDate() : academyDate()) : null,
      notes: form.notes.trim() || null,
    };
    setSaving(true);
    const result = editing
      ? await db().from("student_books").update(payload).eq("id", editing.id).select("*").single()
      : await db().from("student_books").insert(payload).select("*").single();
    setSaving(false);
    if (result.error || !result.data) return setMessage(result.error?.message ?? "The book could not be saved.");
    const saved = { ...payload, ...(result.data as StudentBook), price: Number((result.data as StudentBook).price ?? price) };
    // a db trigger moves the stock, mirror it here
    if (editing?.textbook_id !== saved.textbook_id) onStockChange(stock.map((item) => item.id === editing?.textbook_id ? { ...item, quantity_on_hand: Number(item.quantity_on_hand ?? 0) + 1 } : item.id === saved.textbook_id ? { ...item, quantity_on_hand: Math.max(0, Number(item.quantity_on_hand ?? 0) - 1) } : item));
    onChange(editing ? books.map((book) => book.id === editing.id ? saved : book) : [saved, ...books]);
    setMessage(editing ? "Book updated." : "Book saved.");
    reset();
  }

  async function remove(book: StudentBook) {
    if (!window.confirm(`Delete "${book.title}" from ${student.full_name}'s books?`)) return;
    const { error } = await db().from("student_books").delete().eq("id", book.id);
    if (error) return setMessage(error.message);
    adjustStock(book.textbook_id, 1);
    onChange(books.filter((item) => item.id !== book.id));
    if (editing?.id === book.id) reset();
    setMessage("Book deleted.");
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-labelledby="student-books-title">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-accent bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4 border-b pb-3">
          <div>
            <h2 id="student-books-title" className="flex items-center gap-2 text-lg font-semibold"><BookOpen size={18} /> Books</h2>
            <p className="text-sm text-muted-foreground">{student.full_name}</p>
          </div>
          <Button size="sm" variant="outline" onClick={onClose}><X size={16} /> Close</Button>
        </div>

        <div className="space-y-2">
          {books.map((book) => (
            <div key={book.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
              <div className="space-y-1">
                <p className="font-semibold">{book.title}</p>
                <p className="text-muted-foreground">Received {book.received_at} · {formatMoney(Number(book.price ?? 0))}{book.paid_at ? ` · Paid on ${book.paid_at}` : ""}</p>
                {book.notes && <p className="text-muted-foreground">{book.notes}</p>}
              </div>
              <div className="flex items-center gap-2">
                <BookStatusBadge book={book} />
                <Button size="icon" variant="ghost" onClick={() => startEdit(book)} aria-label="Edit book"><Edit2 size={16} /></Button>
                <Button size="icon" variant="ghost" onClick={() => void remove(book)} aria-label="Delete book"><Trash2 size={16} /></Button>
              </div>
            </div>
          ))}
          {!books.length && <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">No books yet.</p>}
        </div>

        <form className="mt-5 grid gap-3 border-t pt-4 md:grid-cols-2" onSubmit={(event) => void save(event)}>
          <p className="font-semibold md:col-span-2">{editing ? "Edit book" : "Add book"}</p>
          <label className="grid gap-1 text-sm md:col-span-2"><span className="font-medium">Book</span>
            <Select value={form.source} onChange={(event) => setField("source", event.target.value)}>
              <option value="">Choose a book...</option>
              {stock.map((book) => <option key={book.id} value={book.id}>{book.title}{book.level ? ` · ${book.level}` : ""} ({Number(book.quantity_on_hand ?? 0)} in stock)</option>)}
              <option value={OTHER}>Other book, type the title</option>
            </Select>
          </label>
          {chosen && Number(chosen.quantity_on_hand ?? 0) <= 0 && editing?.textbook_id !== chosen.id && <p className="text-sm text-amber-700 md:col-span-2">This book shows 0 in stock. Saving still records it; check the textbook inventory.</p>}
          {form.source === OTHER && <label className="grid gap-1 text-sm md:col-span-2"><span className="font-medium">Book title</span><Input value={form.title} onChange={(event) => setField("title", event.target.value)} /></label>}
          <label className="grid gap-1 text-sm"><span className="font-medium">Received on</span><Input type="date" value={form.received_at} onChange={(event) => setField("received_at", event.target.value)} /></label>
          <label className="grid gap-1 text-sm"><span className="font-medium">Book price</span><Input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setField("price", event.target.value)} /></label>
          <label className="grid gap-1 text-sm"><span className="font-medium">Book payment</span>
            <Select value={form.payment_status} onChange={(event) => setField("payment_status", event.target.value as StudentBook["payment_status"])}>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
              <option value="arranged">Will pay on a date</option>
            </Select>
          </label>
          {form.payment_status === "arranged" && <label className="grid gap-1 text-sm"><span className="font-medium">Will pay on</span><Input type="date" value={form.payment_due_date} onChange={(event) => setField("payment_due_date", event.target.value)} /></label>}
          <label className="grid gap-1 text-sm md:col-span-2"><span className="font-medium">Book notes</span><Input value={form.notes} onChange={(event) => setField("notes", event.target.value)} /></label>
          <div className="flex gap-2 md:col-span-2">
            <Button className="flex-1" disabled={saving}>{saving ? "Saving..." : editing ? "Update book" : "Save book"}</Button>
            {editing && <Button type="button" variant="outline" onClick={reset}>Cancel</Button>}
          </div>
          {message && <p className="text-sm text-muted-foreground md:col-span-2">{message}</p>}
        </form>
      </div>
    </div>
  );
}
