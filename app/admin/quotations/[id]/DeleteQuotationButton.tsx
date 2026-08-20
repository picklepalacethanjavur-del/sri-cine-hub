"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function DeleteQuotationButton({ quotationId, quotationCode, quoteRequestId }: {
  quotationId: string;
  quotationCode: string;
  quoteRequestId: string | null;
}) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete ${quotationCode}? This cannot be undone.`)) return;
    setBusy(true);
    const { error } = await supabase.from("quotations").delete().eq("id", quotationId);
    if (error) { alert(error.message); setBusy(false); return; }
    location.href = quoteRequestId ? `/admin/quote-requests/${quoteRequestId}` : "/admin/quotations";
  }

  return (
    <button
      type="button"
      className="button"
      disabled={busy}
      onClick={() => void handleDelete()}
      style={{ background: "#7a1e1e", borderColor: "#c0392b", color: "#fff", fontWeight: 700 }}
    >
      {busy ? "Deleting…" : "Delete Quote"}
    </button>
  );
}
