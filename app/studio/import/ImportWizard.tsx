"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type CatalogItem = { id: string; type: "camera" | "accessory"; code: string; name: string; rate: number };
type ParsedItem = {
  key: string;
  rawLine: string;
  description: string;
  item_type: "camera" | "accessory" | "manual";
  item_id: string;
  matchedName: string;
  matchScore: number;
  quantity: number;
  rental_days: number;
  rate: number;
};

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function matchScore(query: string, target: string): number {
  const q = norm(query);
  const t = norm(target);
  if (!q || !t) return 0;
  if (t === q) return 1;
  if (t.includes(q) || q.includes(t)) return 0.9;
  const qw = q.split(" ").filter((w) => w.length > 2);
  const tw = t.split(" ");
  if (!qw.length) return 0;
  const hits = qw.filter((w) => tw.some((tw) => tw.includes(w) || w.includes(tw)));
  return hits.length / Math.max(qw.length, tw.length);
}

function isSectionHeader(line: string): boolean {
  // Only skip if there is NO list marker (* - •) — lines with markers are always items
  if (/^[*•\-\d]/.test(line.trim())) return false;
  // Single-word letter-only lines without a marker are section labels ("Camera", "Lights")
  // Multi-word lines without markers ("Batis Lens Kit") are still treated as items
  const clean = line.trim();
  return /^[A-Za-z]+$/.test(clean) && clean.length <= 20;
}

function parseText(text: string, catalog: CatalogItem[]): ParsedItem[] {
  const SKIP = /^(hi|hello|dear|regards|thanks|please|note[:\s]|from[:\s]|to[:\s]|date[:\s]|subject[:\s]|re[:\s]|\d{10}|https?:)/i;
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && !SKIP.test(l) && !isSectionHeader(l));

  const results: ParsedItem[] = [];

  for (const line of lines) {
    let raw = line;
    let qty = 1;
    let days = 1;

    // 1. Strip list markers (* - • 1. etc.)
    raw = raw.replace(/^[*•\-\d.)\s]+/, "").trim();
    if (!raw || raw.length < 2) continue;

    // 2. Strip price suffixes: "= 11000", "= 1000 = 1600" (must come before qty detection)
    raw = raw.replace(/\s*=\s*[\d,]+.*$/, "").trim();

    // 3. Extract trailing qty: "– 2 Nos." / "- 3 nos" / "– 2" at end of string
    //    Use em-dash OR hyphen only when followed by digits (avoids stripping hyphenated names)
    const trailingQty = raw.match(/\s*[––]\s*(\d+)\.?\s*(?:nos?\.?|pcs?\.?|units?\.?)?\s*$/i);
    if (trailingQty) {
      qty = parseInt(trailingQty[1]);
      raw = raw.slice(0, trailingQty.index).trim();
    }

    // 4. Extract leading/other qty patterns (only if not already found)
    if (qty === 1) {
      const qPatterns: [RegExp, number][] = [
        [/^(\d+)\s*[x×]\s*/i, 1],
        [/\s*[x×]\s*(\d+)\s*$/i, 1],
        [/^(\d+)\s+(?:nos?\.?|pcs?\.?|units?)\s+/i, 1],
        [/\((\d+)\s*(?:nos?\.?|pcs?\.?|units?)?\)\s*$/, 1],
        [/^qty\s*[:\-]?\s*(\d+)\s*/i, 1],
      ];
      for (const [pat, grp] of qPatterns) {
        const m = raw.match(pat);
        if (m) { qty = parseInt(m[grp]); raw = raw.replace(m[0], "").trim(); break; }
      }
    }

    // 5. Extract rental days
    const dm = raw.match(/\bfor\s+(\d+)\s+days?\b|\b(\d+)\s+days?\b/i);
    if (dm) { days = parseInt(dm[1] || dm[2]); raw = raw.replace(dm[0], "").trim(); }

    raw = raw.trim();
    if (!raw || raw.length < 2) continue;

    // 6. Fuzzy match against catalog
    let best: CatalogItem | null = null;
    let bestScore = 0;
    for (const item of catalog) {
      const s = matchScore(raw, item.name);
      if (s > bestScore) { bestScore = s; best = item; }
    }

    const matched = bestScore >= 0.35 && best;
    results.push({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      rawLine: line,
      description: matched ? best!.name : raw,
      item_type: matched ? best!.type : "manual",
      item_id: matched ? best!.id : "",
      matchedName: matched ? `${best!.code} · ${best!.name}` : "",
      matchScore: bestScore,
      quantity: qty,
      rental_days: days,
      rate: matched ? best!.rate : 0,
    });
  }
  return results;
}

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export function ImportWizard({ catalog }: { catalog: CatalogItem[] }) {
  const router = useRouter();
  const [step, setStep] = useState<"input" | "review">("input");
  const [text, setText] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function handleParse() {
    const parsed = parseText(text, catalog);
    if (!parsed.length) { setError("No equipment items found in the pasted text. Try a different format."); return; }
    setError("");
    setItems(parsed);
    setStep("review");
  }

  function updateItem(key: string, patch: Partial<ParsedItem>) {
    setItems((prev) => prev.map((i) => i.key === key ? { ...i, ...patch } : i));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function addManual() {
    setItems((prev) => [...prev, {
      key: `manual-${Date.now()}`,
      rawLine: "",
      description: "",
      item_type: "manual",
      item_id: "",
      matchedName: "",
      matchScore: 0,
      quantity: 1,
      rental_days: 1,
      rate: 0,
    }]);
  }

  async function handleCreate() {
    if (!items.length) return;
    setCreating(true);
    setError("");
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
          <textarea
            className="importTextarea"
            rows={14}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Example:\nArri Alexa 35 x1\n2x RED V-Raptor 8K\nWireless Follow Focus - 2 nos\nGimbal - 1 (for 3 days)\nLap mic x2"}
          />
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
                <>
                  <span className="importMatchCode">{item.matchedName}</span>
                  <span className="importMatchRaw">{item.rawLine}</span>
                </>
              ) : (
                <input
                  className="importInput"
                  style={{ fontSize: 12 }}
                  value={item.description}
                  onChange={(e) => updateItem(item.key, { description: e.target.value })}
                  placeholder="Describe item…"
                />
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
        Unmatched items (orange) will be added as manual lines. You can adjust rates in the quotation editor.
      </p>
    </div>
  );
}
