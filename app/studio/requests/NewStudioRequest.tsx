"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function NewStudioRequest({ userId }: { userId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setMsg("");
    try {
      const { data, error } = await supabase.from("quote_requests").insert({
        company_name: String(f.get("company") || "").trim() || null,
        name: String(f.get("name") || "").trim() || null,
        project_name: String(f.get("project") || "").trim() || null,
        phone: String(f.get("phone") || "").trim() || null,
        start_at: f.get("start_at") ? new Date(String(f.get("start_at"))).toISOString() : null,
        end_at: f.get("end_at") ? new Date(String(f.get("end_at"))).toISOString() : null,
        notes: String(f.get("notes") || "").trim() || null,
        status: "reviewing",
        source: "internal",
      }).select("id").single();
      if (error) throw error;
      router.push(`/studio/requests/${data.id}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to create request.");
      setBusy(false);
    }
  }

  if (!open) return <button className="btn btnGold" onClick={() => setOpen(true)}>+ New Request</button>;

  return (
    <div className="studioDrawer">
      <div className="studioDrawerHead">
        <h3>New Quote Request</h3>
        <button className="studioDrawerClose" onClick={() => setOpen(false)}>×</button>
      </div>
      <form className="studioDrawerForm" onSubmit={submit}>
        <div className="studioFormGrid2">
          <label>Company / Production<input name="company" placeholder="Company name" /></label>
          <label>Contact name<input name="name" placeholder="Contact person" /></label>
        </div>
        <label>Project name<input name="project" placeholder="Film / commercial / series name" /></label>
        <div className="studioFormGrid2">
          <label>Start date<input name="start_at" type="datetime-local" /></label>
          <label>Return date<input name="end_at" type="datetime-local" /></label>
        </div>
        <label>Phone<input name="phone" placeholder="+91 00000 00000" /></label>
        <label>Equipment notes<textarea name="notes" rows={3} placeholder="What equipment do they need?" /></label>
        {msg && <p className="studioError">{msg}</p>}
        <div className="studioFormActions">
          <button type="button" className="btn btnGhost" onClick={() => setOpen(false)}>Cancel</button>
          <button type="submit" className="btn btnGold" disabled={busy}>{busy ? "Creating…" : "Create & Build Quote"}</button>
        </div>
      </form>
    </div>
  );
}
