"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function NewRequestForm() {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr("");
    const startVal = String(f.get("start_at") || "").trim();
    const endVal   = String(f.get("end_at")   || "").trim();
    try {
      const { data, error } = await supabase.from("quote_requests").insert({
        company_name: String(f.get("company") || "").trim() || null,
        name:         String(f.get("name")    || "").trim() || null,
        project_name: String(f.get("project") || "").trim() || null,
        phone:        String(f.get("phone")   || "").trim() || null,
        start_at:     startVal ? new Date(startVal).toISOString() : null,
        end_at:       endVal   ? new Date(endVal).toISOString()   : null,
        notes:        String(f.get("notes")   || "").trim() || null,
        status: "new",
      }).select("id").single();
      if (error) throw error;
      router.push(`/studio/requests/${data.id}`);
    } catch (e: any) {
      setErr(e?.message || e?.details || "Failed to create request. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="studioPage newReqPage">
      <div className="studioPageHeader">
        <p className="studioEyebrow">REQUESTS · NEW</p>
        <h1 className="studioH1">New Quote Request</h1>
      </div>

      <form className="newReqForm" onSubmit={submit}>
        <div className="newReqTopGrid">
          <label className="newReqLabel">
            Company / Production
            <input name="company" className="newReqInput" placeholder="Production house or company" autoFocus />
          </label>
          <label className="newReqLabel">
            Contact name
            <input name="name" className="newReqInput" placeholder="Person to call" />
          </label>
          <label className="newReqLabel">
            Project name
            <input name="project" className="newReqInput" placeholder="Film / commercial / series name" />
          </label>
        </div>

        <div className="newReqMidGrid">
          <label className="newReqLabel">
            Shoot start
            <input name="start_at" type="date" className="newReqInput" />
          </label>
          <label className="newReqLabel">
            Return date
            <input name="end_at" type="date" className="newReqInput" />
          </label>
          <label className="newReqLabel">
            Phone / WhatsApp
            <input name="phone" type="tel" className="newReqInput" placeholder="+91 98765 43210" />
          </label>
        </div>

        <label className="newReqLabel newReqEquip">
          Equipment needed
          <span className="newReqEquipHint">Paste a WhatsApp message or equipment list — we&apos;ll auto-parse it when the builder opens</span>
          <textarea
            name="notes"
            className="newReqTextarea"
            placeholder={"Camera\n\n* Sony FX3 - 2 no's\n* Gimbal - 1\n\nLights\n\n* Nanlite 4ft tube - 4 no's\n* Aputure MC kit = 1 no\n\nGrip\n\n* 4x4 frames - 8 no's\n* Boom rod - 2 no's"}
          />
        </label>

        {err && <p className="studioError">{err}</p>}

        <div className="newReqActions">
          <Link href="/studio/requests" className="btn btnGhost">Cancel</Link>
          <button type="submit" className="btn btnGold" disabled={busy}>
            {busy ? "Creating…" : "Create & Build Quote →"}
          </button>
        </div>
      </form>
    </div>
  );
}
