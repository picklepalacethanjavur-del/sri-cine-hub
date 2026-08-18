"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function PayoutForm({ investors }: { investors: { id: string; name: string }[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    investor_id: investors[0]?.id || "",
    amount_inr: "",
    paid_at: new Date().toISOString().slice(0, 10),
    payment_mode: "bank_transfer",
    notes: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.investor_id || !form.amount_inr || !form.paid_at) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("investor_payouts").insert({
      investor_id: form.investor_id,
      amount_inr: Number(form.amount_inr),
      paid_at: form.paid_at,
      payment_mode: form.payment_mode || null,
      notes: form.notes || null,
    });
    setSaving(false);
    if (!error) {
      setDone(true);
      setForm(f => ({ ...f, amount_inr: "", notes: "" }));
      router.refresh();
      setTimeout(() => setDone(false), 3000);
    }
  }

  return (
    <form className="investPayoutForm" onSubmit={submit}>
      <div className="investPayoutFormRow">
        <label>
          <span>Investor</span>
          <select value={form.investor_id} onChange={e => setForm(f => ({ ...f, investor_id: e.target.value }))}>
            {investors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </label>
        <label>
          <span>Amount (₹)</span>
          <input
            type="number" min="1" step="0.01" placeholder="e.g. 50000"
            value={form.amount_inr}
            onChange={e => setForm(f => ({ ...f, amount_inr: e.target.value }))}
            required
          />
        </label>
        <label>
          <span>Date</span>
          <input
            type="date" value={form.paid_at}
            onChange={e => setForm(f => ({ ...f, paid_at: e.target.value }))}
            required
          />
        </label>
        <label>
          <span>Mode</span>
          <select value={form.payment_mode} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))}>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="upi">UPI</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
          </select>
        </label>
      </div>
      <div className="investPayoutFormRow">
        <label style={{ flex: 1 }}>
          <span>Notes (optional)</span>
          <input
            type="text" placeholder="e.g. Q1 profit share"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
        </label>
        <button type="submit" className="investPayoutSubmit" disabled={saving}>
          {saving ? "Saving…" : done ? "Saved ✓" : "Record payout"}
        </button>
      </div>
    </form>
  );
}
