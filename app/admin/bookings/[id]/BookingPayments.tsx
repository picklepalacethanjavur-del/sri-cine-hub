"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const todayStr = () => new Date().toISOString().slice(0, 10);

export function BookingPayments({ bookingId, payments, totalCharges }: {
  bookingId: string;
  payments: any[];
  totalCharges: number;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("advance");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(todayStr());
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount_inr || 0), 0);
  const outstanding = totalCharges - totalPaid;

  async function addPayment() {
    if (!amount || Number(amount) <= 0) { setErr("Enter a valid amount."); return; }
    setBusy(true); setErr("");
    try {
      const { error } = await supabase.from("payments").insert({
        booking_id: bookingId,
        amount_inr: Number(amount),
        transaction_type: type,
        method,
        received_at: new Date(date + "T12:00:00").toISOString(),
        reference: reference || null,
        notes: notes || null,
      });
      if (error) throw error;
      setOpen(false);
      setAmount(""); setReference(""); setNotes("");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Failed to record payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adminPanel" style={{ marginBottom: 14 }}>
      <div className="panelHeading" style={{ marginBottom: 4 }}>
        <div>
          <h2 style={{ margin: "0 0 4px" }}>Payments</h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            Charged: <strong style={{ color: "var(--text)" }}>{money(totalCharges)}</strong>
            {" · "}
            Paid: <strong style={{ color: "var(--green)" }}>{money(totalPaid)}</strong>
            {" · "}
            Outstanding: <strong style={{ color: outstanding > 0 ? "#f59e0b" : "var(--green)" }}>{money(outstanding)}</strong>
          </p>
        </div>
        <button type="button" className="button ghost" onClick={() => { setOpen(true); setErr(""); }}>
          + Add Payment
        </button>
      </div>

      {payments.length === 0 && <p className="formNote" style={{ marginTop: 14 }}>No payments recorded yet.</p>}

      {payments.map((p: any) => (
        <div className="bookingRow" key={p.id}>
          <div style={{ flex: 1 }}>
            <b style={{ color: "var(--green)" }}>{money(p.amount_inr)}</b>
            <span>
              {p.transaction_type || "payment"}
              {" · "}
              {p.method || "—"}
              {" · "}
              {new Date(p.received_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              {p.reference ? ` · ${p.reference}` : ""}
              {p.notes ? ` · ${p.notes}` : ""}
            </span>
          </div>
        </div>
      ))}

      {open && (
        <div className="modalOverlay" onClick={() => setOpen(false)}>
          <div className="modalBox" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px" }}>Record Payment</h3>
            <div className="formGrid">
              <label>Amount (₹) *
                <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" autoFocus />
              </label>
              <label>Date *
                <input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </label>
            </div>
            <div className="formGrid">
              <label>Type
                <select value={type} onChange={e => setType(e.target.value)}>
                  <option value="advance">Advance</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="final">Final</option>
                </select>
              </label>
              <label>Method
                <select value={method} onChange={e => setMethod(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </label>
            </div>
            <label style={{ marginBottom: 10 }}>Reference / UTR
              <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Optional" />
            </label>
            <label>Notes
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
            </label>
            {outstanding > 0 && amount && Number(amount) > 0 && (
              <p className="formNote" style={{ marginTop: 8 }}>
                After this: outstanding = <strong>{money(outstanding - Number(amount))}</strong>
              </p>
            )}
            {err && <p className="studioError">{err}</p>}
            <div className="panelActions" style={{ marginTop: 14 }}>
              <button type="button" className="button ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="button gold" disabled={busy} onClick={addPayment}>
                {busy ? "Saving…" : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
