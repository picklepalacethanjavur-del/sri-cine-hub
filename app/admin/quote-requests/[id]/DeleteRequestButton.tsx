"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function DeleteRequestButton({ requestId, requestCode }: { requestId: string; requestCode: string }) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete request ${requestCode}? All associated quotations will also be deleted. This cannot be undone.`)) return;
    setBusy(true);
    const { error } = await supabase.from("quote_requests").delete().eq("id", requestId);
    if (error) { alert(error.message); setBusy(false); return; }
    location.href = "/admin/quote-requests";
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void handleDelete()}
      style={{ background: "#7a1e1e", borderColor: "#c0392b", color: "#fff", fontWeight: 700, padding: "6px 14px", borderRadius: 8, border: "1px solid", cursor: "pointer", fontSize: 13 }}
    >
      {busy ? "Deleting…" : "Delete Request"}
    </button>
  );
}
