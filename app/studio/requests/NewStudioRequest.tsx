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
      const startVal = String(f.get("start_at") || "").trim();
      const endVal   = String(f.get("end_at")   || "").trim();
      const { data, error } = await supabase.from("quote_requests").insert({
        company_name: String(f.get("company") || "").trim() || null,
        name:         String(f.get("name")    || "").trim() || null,
        project_name: String(f.get("project") || "").trim() || null,
        phone:        String(f.get("phone")   || "").trim() || null,
        start_at:     startVal ? new Date(startVal).toISOString() : null,
        end_at:       endVal   ? new Date(endVal).toISOString()   : null,
        notes:        String(f.get("notes")   || "").trim() || null,
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
    <>
      <div className="studioDrawerOverlay" onClick={() => setOpen(false)} />
      <div className="studioDrawer">
        <div className="studioDrawerHead">
          <h3>New Quote Request</h3>
          <button className="studioDrawerClose" onClick={() => setOpen(false)}>×</button>
        </div>
        <form className="studioDrawerForm" onSubmit={submit}>
          <div className="studioFormGrid2">
            <label>
              Company / Production
              <input name="company" placeholder="Company or production house" autoFocus />
            </label>
            <label>
              Contact name
              <input name="name" placeholder="Person to call" />
            </label>
          </div>
          <label>
            Project name
            <input name="project" placeholder="Film / commercial / series name" />
          </label>
          <div className="studioFormGrid2">
            <label>
              Start date
              <input name="start_at" type="date" />
            </label>
            <label>
              Return date
              <input name="end_at" type="date" />
            </label>
          </div>
          <label>
            Phone
            <input name="phone" type="tel" placeholder="+91 98765 43210" />
          </label>
          <label>
            Equipment needed
            <textarea name="notes" rows={4} placeholder="e.g. ARRI Alexa + anamorphic lenses + lighting for 5 days outdoor" />
          </label>
          {msg && <p className="studioError">{msg}</p>}
          <div className="studioFormActions">
            <button type="button" className="btn btnGhost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn btnGold" disabled={busy}>
              {busy ? "Creating…" : "Create & Build Quote"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
