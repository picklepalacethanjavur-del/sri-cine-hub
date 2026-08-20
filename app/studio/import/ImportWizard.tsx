"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseEquipmentText, type CatalogEntry, type ParsedEquipmentItem } from "@/lib/parseEquipmentText";

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export function ImportWizard({ catalog }: { catalog: CatalogEntry[] }) {
  const router = useRouter();
  const [step, setStep] = useState<"input" | "review">("input");
  const [text, setText] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [items, setItems] = useState<ParsedEquipmentItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function handleParse() {
    const parsed = parseEquipmentText(text, catalog);
    if (!parsed.length) { setError("No equipment items found. Try adding * or - before each item."); return; }
    setError("");
    setItems(parsed);
    setStep("review");
  }

  function updateItem(key: string, patch: Partial<ParsedEquipmentItem>) {
    setItems((prev) => prev.map((i) => i.key === key ? { ...i, ...patch } : i));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function addManual() {
    setItems((prev) => [...prev, {
      key: `manual-${Date.now()}`,
      rawLine: "", description: "", item_type: "manual",
      item_id: "", matchedName: "", matchScore: 0,
      quantity: 1, rental_days: 1, rate: 0,
    }]);
  }

  async function handleCreate() {
    if (!items.length) return;
    setCreating(true); setError("");
    try {
      const res = await fetch("/api/studio/create-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: companyName || "Imported", phone, start_at: startAt || null, end_at: endAt || null, items }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create");
      router.push(`/admin/quotations/${json.quotationId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create quote");
      setCreating(false);
    }
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.rental_days * i.rate, 0);

  if (step === "input") {
    return (
      <div className="importWrap">
        <div className="importMeta">
          <label className="importLabel">Production house / Customer<input className="importInput" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Red Carpet Films" /></label>
          <label className="importLabel">WhatsApp / Phone<input className="importInput" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9xxxxxxxxx" /></label>
          <label className="importLabel">Shoot start<input className="importInput" type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} /></label>
          <label className="importLabel">Shoot end<input className="importInput" type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} /></label>
        </div>
        <label className="importLabel" style={{ display: "grid", gap: 6 }}>
          Paste WhatsApp message or equipment list
          <textarea className="importTextarea" rows={14} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={"Example:\n* Arri Alexa 35 x1\n* RED V-Raptor - 2 nos\n* Wireless Follow Focus - 2 no's\n* Gimbal - 1\n* Lap mic x2"} />
        </label>
        {error && <div className="errorBox">{error}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button className="button gold" disabled={!text.trim()} onClick={handleParse}>Parse Items →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="importWrap">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button className="button ghost" style={{ fontSize: 12 }} onClick={() => setStep("input")}>← Back</button>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>{items.length} item{items.length !== 1 ? "s" : ""} parsed</span>
        {companyName && <span className="workflowBadge draft" style={{ marginLeft: "auto" }}>{companyName}</span>}
      </div>
      <div className="importReviewTable">
        <div className="importReviewHead">
          <span>Item</span><span>Qty</span><span>Days</span><span>Rate/day</span><span>Total</span><span></span>
        </div>
        {items.map((item) => (
          <div key={item.key} className={`importReviewRow${item.item_type === "manual" ? " unmatched" : ""}`}>
            <div className="importReviewItem">
              {item.item_type !== "manual" ? (
                <><span className="importMatchCode">{item.matchedName}</span><span className="importMatchRaw">{item.rawLine}</span></>
              ) : (
                <input className="importInput" style={{ fontSize: 12 }} value={item.description}
                  onChange={(e) => updateItem(item.key, { description: e.target.value })} placeholder="Describe item…" />
              )}
            </div>
            <input className="importNumInput" type="number" min={1} value={item.quantity} onChange={(e) => updateItem(item.key, { quantity: parseInt(e.target.value) || 1 })} />
            <input className="importNumInput" type="number" min={1} value={item.rental_days} onChange={(e) => updateItem(item.key, { rental_days: parseInt(e.target.value) || 1 })} />
            <input className="importNumInput" type="number" min={0} value={item.rate} onChange={(e) => updateItem(item.key, { rate: parseInt(e.target.value) || 0 })} />
            <span className="importLineTotal">{money(item.quantity * item.rental_days * item.rate)}</span>
            <button className="quoteChipDelete" onClick={() => removeItem(item.key)} title="Remove">×</button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <button className="button ghost" style={{ fontSize: 12 }} onClick={addManual}>+ Add line</button>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>Subtotal: <b style={{ color: "var(--gold2)" }}>{money(subtotal)}</b></span>
      </div>
      {error && <div className="errorBox" style={{ marginTop: 10 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button className="button gold" disabled={creating || !items.length} onClick={handleCreate}>
          {creating ? "Creating…" : "Create Draft Quote →"}
        </button>
      </div>
      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 8 }}>
        Unmatched items (orange) will be added as manual lines. Rates can be adjusted in the quotation editor.
      </p>
    </div>
  );
}
