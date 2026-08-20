"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { parseEquipmentText, type CatalogEntry, type ParsedEquipmentItem } from "@/lib/parseEquipmentText";

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
function fmtDate(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

type Line = {
  key: string;
  description: string;
  section_name: string;
  quantity: number;
  rental_days: number;
  quoted_rate_inr: number;
  source_type: string;
  item_id: string;
  supplier_id: string;
  supplier_catalog_item_id: string;
  internal_cost_inr: number;
  notes: string;
};

function newKey() { return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }

export function QuoteBuilder({ request, cameras, accessories, supplierItems, existingQuotes, bookedCameraIds, bookedAccessoryIds, rentalDays, internalRates, isAdmin }: any) {
  const supabase = createClient();
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"import" | "own" | "supplier" | "manual">(
    request?.notes?.trim() ? "import" : "own"
  );
  const [ownSearch, setOwnSearch] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [saving, setSaving] = useState<"draft" | "generate" | null>(null);
  const [msg, setMsg] = useState("");
  const [discount, setDiscount] = useState(0);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const autoSavedIdRef = useRef<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"" | "saving" | "saved">("");

  // Import tab state
  const [importText, setImportText] = useState<string>(request?.notes?.trim() || "");
  const [importItems, setImportItems] = useState<ParsedEquipmentItem[]>([]);
  const [importAddedKeys, setImportAddedKeys] = useState<Set<string>>(new Set());
  const [importParsed, setImportParsed] = useState(false);
  const [importErr, setImportErr] = useState("");

  const importCatalog = useMemo<CatalogEntry[]>(() => {
    const rateMap = new Map<string, number>();
    for (const r of internalRates || []) {
      if (r.camera_id && !rateMap.has(`c-${r.camera_id}`)) rateMap.set(`c-${r.camera_id}`, r.daily_rate_inr);
      if (r.accessory_id && !rateMap.has(`a-${r.accessory_id}`)) rateMap.set(`a-${r.accessory_id}`, r.daily_rate_inr);
    }
    return [
      ...(cameras || []).map((c: any) => ({
        id: c.id, type: "camera" as const, code: c.camera_code,
        name: [c.name, c.manufacturer, c.model].filter(Boolean).join(" "),
        rate: rateMap.get(`c-${c.id}`) || 0,
      })),
      ...(accessories || []).map((a: any) => ({
        id: a.id, type: "accessory" as const, code: a.accessory_code,
        name: [a.name, a.category].filter(Boolean).join(" "),
        rate: rateMap.get(`a-${a.id}`) || 0,
      })),
    ];
  }, [cameras, accessories, internalRates]);

  // Auto-parse if request has equipment notes
  useEffect(() => {
    if (request?.notes?.trim() && importCatalog.length > 0) {
      const parsed = parseEquipmentText(request.notes, importCatalog);
      setImportItems(parsed);
      setImportParsed(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function runImportParse() {
    if (!importText.trim()) return;
    const parsed = parseEquipmentText(importText, importCatalog);
    if (!parsed.length) { setImportErr("No items found. Try adding * or - before each item."); return; }
    setImportErr("");
    setImportItems(parsed);
    setImportParsed(true);
    setImportAddedKeys(new Set());
  }

  function addParsedLine(item: ParsedEquipmentItem) {
    const days = item.rental_days > 1 ? item.rental_days : rentalDays;
    if (item.item_type === "camera") {
      const cam = (cameras || []).find((c: any) => c.id === item.item_id);
      setLines(prev => [...prev, {
        key: newKey(), description: cam ? `${cam.camera_code} · ${cam.name}` : item.description,
        section_name: "Cameras", quantity: item.quantity, rental_days: days,
        quoted_rate_inr: item.rate, source_type: "own_camera", item_id: item.item_id,
        supplier_id: "", supplier_catalog_item_id: "", internal_cost_inr: 0, notes: "",
      }]);
    } else if (item.item_type === "accessory") {
      const acc = (accessories || []).find((a: any) => a.id === item.item_id);
      setLines(prev => [...prev, {
        key: newKey(), description: acc ? `${acc.accessory_code} · ${acc.name}` : item.description,
        section_name: acc?.category || "Accessories", quantity: item.quantity, rental_days: days,
        quoted_rate_inr: item.rate, source_type: "own_accessory", item_id: item.item_id,
        supplier_id: "", supplier_catalog_item_id: "", internal_cost_inr: 0, notes: "",
      }]);
    } else {
      setLines(prev => [...prev, {
        key: newKey(), description: item.description, section_name: "Other",
        quantity: item.quantity, rental_days: days, quoted_rate_inr: item.rate,
        source_type: "manual", item_id: "", supplier_id: "", supplier_catalog_item_id: "",
        internal_cost_inr: 0, notes: item.rawLine || "",
      }]);
    }
    setImportAddedKeys(prev => new Set([...prev, item.key]));
  }

  function addAllParsed() {
    importItems.filter(i => !importAddedKeys.has(i.key)).forEach(addParsedLine);
  }

  const subtotal = lines.reduce((n, l) => n + (l.quantity * l.rental_days * l.quoted_rate_inr), 0);
  const total = Math.max(0, subtotal - discount);

  async function deleteQuote(qid: string, code: string) {
    if (!window.confirm(`Delete ${code}? This cannot be undone.`)) return;
    setDeletingId(qid);
    await supabase.from("quotations").delete().eq("id", qid);
    setDeletingId(null);
    router.refresh();
  }

  function flashAdded(id: string) {
    setAddedIds(prev => new Set([...prev, id]));
    setTimeout(() => setAddedIds(prev => { const n = new Set(prev); n.delete(id); return n; }), 1200);
  }

  function rateFor(camId: string | null, accId: string | null): number {
    if (camId) {
      const r = (internalRates || []).find((x: any) => x.camera_id === camId);
      return Number(r?.daily_rate_inr || 0);
    }
    if (accId) {
      const r = (internalRates || []).find((x: any) => x.accessory_id === accId);
      return Number(r?.daily_rate_inr || 0);
    }
    return 0;
  }

  function addCamera(cam: any) {
    setLines(prev => [...prev, {
      key: newKey(),
      description: `${cam.camera_code} · ${cam.name}`,
      section_name: "Cameras",
      quantity: 1,
      rental_days: rentalDays,
      quoted_rate_inr: rateFor(cam.id, null),
      source_type: "own_camera",
      item_id: cam.id,
      supplier_id: "",
      supplier_catalog_item_id: "",
      internal_cost_inr: 0,
      notes: "",
    }]);
    flashAdded(cam.id);
  }

  function addAccessory(acc: any) {
    setLines(prev => [...prev, {
      key: newKey(),
      description: `${acc.accessory_code} · ${acc.name}`,
      section_name: acc.category || "Accessories",
      quantity: 1,
      rental_days: rentalDays,
      quoted_rate_inr: rateFor(null, acc.id),
      source_type: "own_accessory",
      item_id: acc.id,
      supplier_id: "",
      supplier_catalog_item_id: "",
      internal_cost_inr: 0,
      notes: "",
    }]);
    flashAdded(acc.id);
  }

  function addSupplierItem(item: any) {
    const cost = Number(item.default_cost_inr || 0);
    setLines(prev => [...prev, {
      key: newKey(),
      description: item.supplier_item_name,
      section_name: item.category || "Supplier",
      quantity: 1,
      rental_days: rentalDays,
      quoted_rate_inr: cost,
      source_type: "supplier",
      item_id: "",
      supplier_id: item.supplier_id,
      supplier_catalog_item_id: item.id,
      internal_cost_inr: cost,
      notes: `Supplier: ${item.suppliers?.company_name || ""}`,
    }]);
    flashAdded(item.id);
  }

  function addManualLine() {
    setLines(prev => [...prev, {
      key: newKey(),
      description: "",
      section_name: "Other",
      quantity: 1,
      rental_days: rentalDays,
      quoted_rate_inr: 0,
      source_type: "manual",
      item_id: "",
      supplier_id: "",
      supplier_catalog_item_id: "",
      internal_cost_inr: 0,
      notes: "",
    }]);
  }

  function patch(key: string, v: Partial<Line>) {
    setLines(prev => prev.map(l => l.key === key ? { ...l, ...v } : l));
  }

  function removeLine(key: string) {
    setLines(prev => prev.filter(l => l.key !== key));
  }

  function dbItemType(st: string) {
    if (st === "own_camera") return "camera";
    if (st === "own_accessory") return "accessory";
    return "other";
  }
  function dbSourceType(st: string) {
    if (st === "own_camera" || st === "own_accessory") return "own";
    if (st === "supplier") return "supplier";
    return "manual";
  }

  function buildItems(ls: Line[]) {
    return ls.map((l, i) => ({
      item_type: dbItemType(l.source_type),
      item_id: l.item_id || "",
      request_item_id: "",
      catalog_item_id: "",
      section_name: l.section_name,
      requested_description: l.description,
      description: l.description,
      source_type: dbSourceType(l.source_type),
      quantity: l.quantity,
      rental_days: l.rental_days,
      quoted_rate_inr: l.quoted_rate_inr,
      internal_rate_inr: 0,
      cost_rate_inr: l.internal_cost_inr,
      cost_rate_basis: "daily",
      supplier_id: l.supplier_id || "",
      supplier_catalog_item_id: l.supplier_catalog_item_id || "",
      supplier_name: "",
      supplier_status: "",
      supplier_reference: "",
      notes: l.notes || "",
      sort_order: i,
    }));
  }

  // Auto-save 2.5s after last change
  useEffect(() => {
    if (lines.length === 0) return;
    const currentLines = lines;
    const currentDiscount = discount;
    const timer = setTimeout(async () => {
      setAutoSaveStatus("saving");
      try {
        const items = buildItems(currentLines);
        if (autoSavedIdRef.current) {
          await supabase.rpc("save_quotation_atomic", {
            p_quotation_id: autoSavedIdRef.current,
            p_status: "draft",
            p_discount_inr: currentDiscount,
            p_tax_inr: 0,
            p_other_charges_inr: 0,
            p_customer_notes: null,
            p_internal_notes: null,
            p_items: items,
          });
        } else {
          const { data, error } = await supabase.rpc("create_quotation_atomic", {
            p_quote_request_id: request.id,
            p_status: "draft",
            p_valid_until: null,
            p_discount_inr: currentDiscount,
            p_tax_inr: 0,
            p_other_charges_inr: 0,
            p_customer_notes: null,
            p_internal_notes: null,
            p_items: items,
          });
          if (!error && data) {
            const result = Array.isArray(data) ? data[0] : data;
            if (result?.quotation_id) autoSavedIdRef.current = result.quotation_id;
          }
        }
        setAutoSaveStatus("saved");
      } catch {
        setAutoSaveStatus("");
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [lines, discount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (autoSaveStatus !== "saved") return;
    const t = setTimeout(() => setAutoSaveStatus(""), 3000);
    return () => clearTimeout(t);
  }, [autoSaveStatus]);

  async function save(status: "draft" | "generated") {
    setSaving(status === "generated" ? "generate" : "draft");
    setMsg("");
    try {
      const items = buildItems(lines);
      let qid: string;
      if (autoSavedIdRef.current) {
        const { error } = await supabase.rpc("save_quotation_atomic", {
          p_quotation_id: autoSavedIdRef.current,
          p_status: status,
          p_discount_inr: discount,
          p_tax_inr: 0,
          p_other_charges_inr: 0,
          p_customer_notes: null,
          p_internal_notes: null,
          p_items: items,
        });
        if (error) throw error;
        qid = autoSavedIdRef.current;
      } else {
        const { data, error } = await supabase.rpc("create_quotation_atomic", {
          p_quote_request_id: request.id,
          p_status: status,
          p_valid_until: null,
          p_discount_inr: discount,
          p_tax_inr: 0,
          p_other_charges_inr: 0,
          p_customer_notes: null,
          p_internal_notes: null,
          p_items: items,
        });
        if (error) throw error;
        const result = Array.isArray(data) ? data[0] : data;
        qid = result?.quotation_id;
        if (!qid) throw new Error("No quotation ID returned. Please try again.");
      }
      setSaving(null);
      router.push(status === "generated"
        ? `/admin/quotations/${qid}/print?generated=1`
        : `/admin/quotations/${qid}`);
    } catch (err: any) {
      setMsg(err?.message || err?.details || err?.hint || "Failed to save quotation.");
      setSaving(null);
    }
  }

  const filteredCameras = useMemo(() =>
    cameras.filter((c: any) => `${c.camera_code} ${c.name}`.toLowerCase().includes(ownSearch.toLowerCase())),
    [cameras, ownSearch]
  );

  const filteredAccessories = useMemo(() =>
    accessories.filter((a: any) => `${a.accessory_code} ${a.name} ${a.category}`.toLowerCase().includes(ownSearch.toLowerCase())),
    [accessories, ownSearch]
  );

  const filteredSupplier = useMemo(() =>
    supplierItems.filter((x: any) =>
      `${x.supplier_item_name} ${x.category} ${x.suppliers?.company_name}`.toLowerCase().includes(supplierSearch.toLowerCase())
    ),
    [supplierItems, supplierSearch]
  );

  return (
    <div className="studioPage studioPageWide">
      {/* Client info bar */}
      <div className="quoteClientBar">
        <div>
          <p className="studioEyebrow">{request.request_code}</p>
          <h1 className="studioH1 studioH1sm">{request.company_name || request.name || "Untitled Request"}</h1>
        </div>
        <div className="quoteClientMeta">
          <span>{request.project_name || "—"}</span>
          <span>{fmtDate(request.start_at)} → {fmtDate(request.end_at)} · {rentalDays}d</span>
          {request.phone && <span>{request.phone}</span>}
          {request.notes && <span className="quoteClientNotes">{request.notes}</span>}
        </div>
        {existingQuotes.length > 0 && (
          <div className="quoteExistingList">
            {existingQuotes.map((q: any) => (
              <span key={q.id} className="quoteExistingChipWrap">
                <Link href={`/admin/quotations/${q.id}`} className="quoteExistingChip">
                  {q.quotation_code} · {money(q.total_inr)} · <span>{q.status}</span>
                </Link>
                {isAdmin && (
                  <button
                    className="quoteChipDelete"
                    disabled={deletingId === q.id}
                    onClick={() => deleteQuote(q.id, q.quotation_code)}
                    title="Delete this quotation"
                  >
                    {deletingId === q.id ? "…" : "×"}
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Two-panel builder */}
      <div className="quoteBuilderStudio">

        {/* LEFT: Add items */}
        <div className="quoteAddPanel">
          <div className="quoteAddTabs">
            <button className={tab === "import" ? "active" : ""} onClick={() => setTab("import")}>Import</button>
            <button className={tab === "own" ? "active" : ""} onClick={() => setTab("own")}>Our Gear</button>
            <button className={tab === "supplier" ? "active" : ""} onClick={() => setTab("supplier")}>Supplier</button>
            <button className={tab === "manual" ? "active" : ""} onClick={() => setTab("manual")}>Manual</button>
          </div>

          {tab === "import" && (
            <div className="quoteImportPanel">
              {!importParsed ? (
                <>
                  <textarea
                    className="quoteImportTextarea"
                    rows={10}
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    placeholder={"Paste WhatsApp message or equipment list:\n\n* Sony FX3 - 2 no's\n* Gimbal - 1\n* 4x4 frames - 8 no's"}
                  />
                  {importErr && <p className="studioError">{importErr}</p>}
                  <button className="btn btnGold" style={{ marginTop: 10, width: "100%" }} disabled={!importText.trim()} onClick={runImportParse}>
                    Parse →
                  </button>
                </>
              ) : (
                <>
                  <div className="quoteImportResults">
                    {importItems.map(item => {
                      const added = importAddedKeys.has(item.key);
                      return (
                        <div key={item.key} className={`quoteImportItem${item.item_type === "manual" ? " unmatched" : ""}${added ? " added" : ""}`}>
                          <div className="quoteImportItemInfo">
                            {item.item_type !== "manual"
                              ? <><b>{item.matchedName}</b><span className="quoteImportRaw">{item.rawLine}</span></>
                              : <b>{item.description}</b>
                            }
                            <span className="quoteImportMeta">qty {item.quantity}{item.rental_days > 1 ? ` · ${item.rental_days}d` : ""}{item.rate ? ` · ${money(item.rate)}` : ""}</span>
                          </div>
                          <button className={`quoteImportAdd${added ? " done" : ""}`} disabled={added} onClick={() => !added && addParsedLine(item)}>
                            {added ? "✓" : "+"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="quoteImportActions">
                    <button className="btn btnGhost" style={{ fontSize: 11 }} onClick={() => { setImportParsed(false); setImportItems([]); setImportAddedKeys(new Set()); }}>
                      ← Re-paste
                    </button>
                    {importItems.some(i => !importAddedKeys.has(i.key)) && (
                      <button className="btn btnGold" style={{ fontSize: 11 }} onClick={addAllParsed}>
                        Add all remaining
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "own" && (
            <div className="quoteOwnPanel">
              <input
                className="quoteSupplierSearch"
                placeholder="Search cameras & accessories…"
                value={ownSearch}
                onChange={e => setOwnSearch(e.target.value)}
              />
              <p className="quoteOwnLabel">CAMERAS</p>
              {filteredCameras.length === 0 && <p className="studioEmpty">No cameras match.</p>}
              {filteredCameras.map((cam: any) => {
                const booked = bookedCameraIds.includes(cam.id);
                const added = addedIds.has(cam.id);
                return (
                  <button
                    key={cam.id}
                    className={`quoteOwnItem${booked ? " booked" : ""}${added ? " added" : ""}`}
                    onClick={() => !booked && addCamera(cam)}
                    disabled={booked}
                  >
                    <div className="quoteOwnItemInfo">
                      <b>{cam.camera_code}</b>
                      <span>{cam.name}</span>
                    </div>
                    {added
                      ? <span className="quoteAddedText">✓ Added</span>
                      : <span className={`quoteAvailDot ${booked ? "busy" : "free"}`} />
                    }
                  </button>
                );
              })}

              <p className="quoteOwnLabel" style={{ marginTop: "16px" }}>ACCESSORIES</p>
              {filteredAccessories.length === 0 && <p className="studioEmpty">No accessories match.</p>}
              {filteredAccessories.map((acc: any) => {
                const booked = bookedAccessoryIds.includes(acc.id);
                const added = addedIds.has(acc.id);
                return (
                  <button
                    key={acc.id}
                    className={`quoteOwnItem${booked ? " booked" : ""}${added ? " added" : ""}`}
                    onClick={() => !booked && addAccessory(acc)}
                    disabled={booked}
                  >
                    <div className="quoteOwnItemInfo">
                      <b>{acc.accessory_code}</b>
                      <span>{acc.name} · {acc.category}</span>
                    </div>
                    {added
                      ? <span className="quoteAddedText">✓ Added</span>
                      : <span className={`quoteAvailDot ${booked ? "busy" : "free"}`} />
                    }
                  </button>
                );
              })}
            </div>
          )}

          {tab === "supplier" && (
            <div className="quoteSupplierPanel">
              <input
                className="quoteSupplierSearch"
                placeholder="Search supplier catalog…"
                value={supplierSearch}
                onChange={e => setSupplierSearch(e.target.value)}
              />
              {filteredSupplier.length === 0 && <p className="studioEmpty">No items found.</p>}
              {filteredSupplier.map((item: any) => {
                const added = addedIds.has(item.id);
                return (
                  <button key={item.id} className={`quoteSupplierItem${added ? " added" : ""}`} onClick={() => addSupplierItem(item)}>
                    <div className="quoteSupplierItemInfo">
                      <b>{item.supplier_item_name}</b>
                      <span>{item.category} · {item.suppliers?.company_name}</span>
                    </div>
                    {added
                      ? <span className="quoteAddedText">✓</span>
                      : <span className="quoteSupplierCost">{money(item.default_cost_inr)}/{item.rate_basis}</span>
                    }
                  </button>
                );
              })}
            </div>
          )}

          {tab === "manual" && (
            <div className="quoteManualPanel">
              <p className="studioEmpty" style={{ marginBottom: 14 }}>Add a custom line — service charge, transport, delivery, etc.</p>
              <button className="btn btnGold" onClick={addManualLine}>+ Add Manual Line</button>
            </div>
          )}
        </div>

        {/* RIGHT: Current package */}
        <div className="quotePackagePanel">
          <div className="quotePackageHead">
            <span>PACKAGE · {lines.length} item{lines.length !== 1 ? "s" : ""}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {autoSaveStatus === "saving" && <span className="quoteAutoSaveStatus">Saving…</span>}
              {autoSaveStatus === "saved" && <span className="quoteAutoSaveStatus saved">Draft autosaved ✓</span>}
              <b>{money(total)}</b>
            </div>
          </div>

          <div className="quotePackageLines">
            {lines.length === 0 && (
              <p className="studioEmpty">No items yet. Add from Our Gear or Supplier tab.</p>
            )}
            {lines.map((line, i) => (
              <div key={line.key} className={`quoteLine quoteLineSrc-${line.source_type}`}>
                <div className="quoteLineHeader">
                  <span className="quoteLineNum">{i + 1}</span>
                  <div className="quoteLineDesc">
                    <input
                      value={line.description}
                      onChange={e => patch(line.key, { description: e.target.value })}
                      placeholder="Description"
                      className="quoteLineDescInput"
                    />
                    <span className={`quoteSourceTag ${line.source_type}`}>{line.source_type.replace(/_/g, " ")}</span>
                  </div>
                  <button className="quoteLineRemove" onClick={() => removeLine(line.key)}>×</button>
                </div>
                <div className="quoteLineNumbers">
                  <label>Qty<input type="number" min="1" value={line.quantity} onChange={e => patch(line.key, { quantity: Number(e.target.value) })} /></label>
                  <label>Days<input type="number" min="1" value={line.rental_days} onChange={e => patch(line.key, { rental_days: Number(e.target.value) })} /></label>
                  <label>Rate ₹<input type="number" min="0" value={line.quoted_rate_inr} onChange={e => patch(line.key, { quoted_rate_inr: Number(e.target.value) })} /></label>
                  <div className="quoteLineTotal">{money(line.quantity * line.rental_days * line.quoted_rate_inr)}</div>
                </div>
              </div>
            ))}
          </div>

          {lines.length > 0 && (
            <div className="quotePackageTotals">
              <div className="quoteTotalRow"><span>Subtotal</span><b>{money(subtotal)}</b></div>
              <div className="quoteTotalRow">
                <label>Discount ₹<input type="number" min="0" value={discount} onChange={e => setDiscount(Number(e.target.value))} /></label>
              </div>
              <div className="quoteTotalRow quoteGrandTotal"><span>Total</span><b>{money(total)}</b></div>
              {msg && <p className="studioError">{msg}</p>}
              <div className="quotePackageActions">
                <button className="btn btnGhost" disabled={!!saving} onClick={() => save("draft")}>
                  {saving === "draft" ? "Saving…" : "Save Draft"}
                </button>
                <button className="btn btnGold" disabled={!!saving} onClick={() => save("generated")}>
                  {saving === "generate" ? "Generating…" : "Generate Quote"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {saving && (
        <div className="actionOverlay">
          <div className="actionOverlayCard">
            <b>{saving === "generate" ? "Generating quotation…" : "Saving draft…"}</b>
          </div>
        </div>
      )}
    </div>
  );
}
