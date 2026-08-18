"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export function SupplierManager({ suppliers, items, catalog }: any) {
  const supabase = createClient();
  const router = useRouter();

  const [selected, setSelected] = useState<string>(suppliers[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"suppliers" | "lookup">("suppliers");
  const [lookupSearch, setLookupSearch] = useState("");
  const [editSupplierId, setEditSupplierId] = useState<string | null>(null);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editSupplierData, setEditSupplierData] = useState<any>({});
  const [editItemData, setEditItemData] = useState<any>({});
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);

  const supplier = suppliers.find((x: any) => x.id === selected);
  const supplierItems = items.filter((x: any) => x.supplier_id === selected);
  const filtered = suppliers.filter((x: any) =>
    `${x.company_name} ${x.city || ""} ${x.contact_name || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const lookupResults = useMemo(() => {
    if (!lookupSearch.trim()) return [];
    const q = lookupSearch.toLowerCase();
    return items
      .filter((x: any) => `${x.supplier_item_name} ${x.category || ""}`.toLowerCase().includes(q))
      .map((x: any) => ({ ...x, supplier: suppliers.find((s: any) => s.id === x.supplier_id) }));
  }, [lookupSearch, items, suppliers]);

  const lookupGrouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const row of lookupResults) {
      const key = `${row.supplier_item_name}||${row.category || "Other"}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries()).map(([key, rows]) => {
      const [name, category] = key.split("||");
      return { name, category, rows };
    });
  }, [lookupResults]);

  function startEditSupplier(s: any) {
    setEditSupplierId(s.id);
    setEditSupplierData({
      company_name: s.company_name || "",
      contact_name: s.contact_name || "",
      phone: s.phone || "",
      whatsapp: s.whatsapp || "",
      email: s.email || "",
      city: s.city || "",
      state: s.state || "",
      notes: s.notes || "",
    });
  }

  function startEditItem(x: any) {
    setEditItemId(x.id);
    setEditItemData({
      supplier_item_name: x.supplier_item_name || "",
      category: x.category || "",
      quantity_available: x.quantity_available ?? 1,
      default_cost_inr: x.default_cost_inr ?? 0,
      rate_basis: x.rate_basis || "daily",
      location: x.location || "",
      availability_notes: x.availability_notes || "",
    });
  }

  async function saveEditSupplier() {
    if (!editSupplierId) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.from("suppliers").update({
      ...editSupplierData,
      updated_at: new Date().toISOString(),
    }).eq("id", editSupplierId);
    if (error) setMessage(error.message);
    else { setEditSupplierId(null); router.refresh(); }
    setBusy(false);
  }

  async function saveEditItem() {
    if (!editItemId) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.from("supplier_catalog_items").update({
      supplier_item_name: editItemData.supplier_item_name,
      category: editItemData.category,
      quantity_available: Number(editItemData.quantity_available),
      default_cost_inr: Number(editItemData.default_cost_inr),
      rate_basis: editItemData.rate_basis,
      location: editItemData.location || null,
      availability_notes: editItemData.availability_notes || null,
    }).eq("id", editItemId);
    if (error) setMessage(error.message);
    else { setEditItemId(null); router.refresh(); }
    setBusy(false);
  }

  async function addSupplier(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true); setMessage("");
    try {
      const { data, error } = await supabase.from("suppliers").insert({
        company_name: String(f.get("company") || "").trim(),
        contact_name: String(f.get("contact") || "").trim() || null,
        phone: String(f.get("phone") || "").trim() || null,
        whatsapp: String(f.get("whatsapp") || "").trim() || null,
        email: String(f.get("email") || "").trim() || null,
        city: String(f.get("city") || "").trim() || null,
        state: String(f.get("state") || "").trim() || null,
        notes: String(f.get("notes") || "").trim() || null,
      }).select("id").single();
      if (error) throw error;
      setSelected(data.id);
      setShowAddSupplier(false);
      form.reset();
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to create supplier.");
    } finally {
      setBusy(false);
    }
  }

  async function addSupplierItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true); setMessage("");
    try {
      const catalogId = String(f.get("catalog") || "") || null;
      const master = catalog.find((x: any) => x.id === catalogId);
      const name = String(f.get("name") || "").trim() || master?.canonical_name || "Supplier item";
      const category = String(f.get("category") || "").trim() || master?.category || "Other";
      const { error } = await supabase.from("supplier_catalog_items").insert({
        supplier_id: selected,
        catalog_item_id: catalogId,
        supplier_item_name: name,
        category,
        quantity_available: Number(f.get("qty") || 1),
        default_cost_inr: Number(f.get("cost") || 0),
        rate_basis: String(f.get("basis") || "daily"),
        location: String(f.get("location") || "").trim() || supplier?.city || null,
        availability_notes: String(f.get("availability") || "").trim() || null,
      });
      if (error) throw error;
      setShowAddItem(false);
      form.reset();
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to add supplier item.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSupplier(id: string, current: boolean) {
    setBusy(true); setMessage("");
    const { error } = await supabase.from("suppliers").update({ is_active: !current, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) setMessage(error.message);
    else router.refresh();
    setBusy(false);
  }

  async function removeItem(id: string) {
    if (!confirm("Remove this item from supplier catalog?")) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.from("supplier_catalog_items").delete().eq("id", id);
    if (error) setMessage(error.message);
    else router.refresh();
    setBusy(false);
  }

  return (
    <>
      {/* Metric strip */}
      <div className="supplierMetricGrid">
        <div><span>Suppliers</span><b>{suppliers.length}</b></div>
        <div><span>Supplier equipment</span><b>{items.length}</b></div>
        <div><span>Master catalog</span><b>{catalog.length}</b></div>
      </div>

      {/* Mode tabs */}
      <div className="supplierModeTabs">
        <button className={mode === "suppliers" ? "active" : ""} onClick={() => setMode("suppliers")}>Supplier Directory</button>
        <button className={mode === "lookup" ? "active" : ""} onClick={() => setMode("lookup")}>Find Equipment</button>
      </div>

      {/* Reverse lookup */}
      {mode === "lookup" && (
        <div className="supplierLookupPanel">
          <input
            className="lookupSearch"
            placeholder="Search equipment by name or category (e.g. ARRI, Cooke, LED panel)…"
            value={lookupSearch}
            onChange={e => setLookupSearch(e.target.value)}
            autoFocus
          />
          {lookupSearch.trim() && lookupGrouped.length === 0 && (
            <p className="lookupEmpty">No supplier has equipment matching "{lookupSearch}".</p>
          )}
          {!lookupSearch.trim() && (
            <p className="lookupEmpty">Type equipment name or category to find which suppliers carry it.</p>
          )}
          <div className="lookupResults">
            {lookupGrouped.map(({ name, category, rows }) => (
              <div key={`${name}||${category}`} className="lookupItem">
                <div className="lookupItemName">{name}<span>{category}</span></div>
                {rows.map((row: any) => (
                  <div key={row.id} className="lookupSupplierRow">
                    <div className="lookupSupplierInfo">
                      <b>{row.supplier?.company_name || "Unknown supplier"}</b>
                      <span>{[row.supplier?.contact_name, row.supplier?.phone, row.supplier?.city].filter(Boolean).join(" · ")}{row.availability_notes ? ` — ${row.availability_notes}` : ""}</span>
                    </div>
                    <div className="lookupSupplierMeta">
                      <b>{money(row.default_cost_inr)}/{row.rate_basis}</b>
                      <span>Qty: {row.quantity_available}{row.location ? ` · ${row.location}` : ""}</span>
                    </div>
                    <button className="editBtn" onClick={() => { setMode("suppliers"); setSelected(row.supplier_id); startEditItem(row); }}>✎</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supplier directory */}
      {mode === "suppliers" && (
        <div className="supplierWorkspace">

          {/* LEFT: Supplier list */}
          <aside className="supplierListPanel">
            <div className="smPanelHead">
              <h3 className="smPanelTitle">Suppliers</h3>
              <button
                className={`btn ${showAddSupplier ? "btnGhost" : "btnGold"} smAddBtn`}
                onClick={() => { setShowAddSupplier(v => !v); setEditSupplierId(null); }}
              >
                {showAddSupplier ? "Cancel" : "+ New Supplier"}
              </button>
            </div>

            {showAddSupplier && (
              <form className="smInlineForm" onSubmit={addSupplier}>
                <label>Company name *<input required name="company" autoFocus placeholder="Rental company name" /></label>
                <div className="smFormGrid2">
                  <label>Contact person<input name="contact" placeholder="Name" /></label>
                  <label>Phone<input name="phone" placeholder="+91" /></label>
                </div>
                <div className="smFormGrid2">
                  <label>City<input name="city" placeholder="Chennai" /></label>
                  <label>State<input name="state" placeholder="Tamil Nadu" /></label>
                </div>
                <div className="smFormGrid2">
                  <label>WhatsApp<input name="whatsapp" placeholder="+91" /></label>
                  <label>Email<input name="email" type="email" placeholder="Optional" /></label>
                </div>
                <label>Notes<textarea name="notes" rows={2} placeholder="Optional notes about this supplier" /></label>
                <div className="smFormActions">
                  <button type="button" className="btn btnGhost" onClick={() => setShowAddSupplier(false)}>Cancel</button>
                  <button type="submit" className="btn btnGold" disabled={busy}>{busy ? "Saving…" : "Add Supplier"}</button>
                </div>
              </form>
            )}

            <input
              className="smSearch"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search suppliers…"
            />

            <div className="smSupplierList">
              {filtered.length === 0 && <p className="smEmpty">No suppliers found.</p>}
              {filtered.map((s: any) => (
                <button
                  key={s.id}
                  type="button"
                  className={`smSupplierRow${selected === s.id ? " active" : ""}${!s.is_active ? " inactive" : ""}`}
                  onClick={() => { setSelected(s.id); setEditSupplierId(null); setEditItemId(null); setShowAddItem(false); }}
                >
                  <div className="smSupplierRowInfo">
                    <b>{s.company_name}</b>
                    <span>{[s.city, s.contact_name].filter(Boolean).join(" · ") || "No contact"}</span>
                  </div>
                  <span className="smItemCount">{items.filter((x: any) => x.supplier_id === s.id).length}</span>
                </button>
              ))}
            </div>
          </aside>

          {/* RIGHT: Supplier detail */}
          <section className="supplierDetailPanel">
            {!supplier ? (
              <div className="smEmpty smEmptyCenter">Select a supplier from the list.</div>
            ) : (
              <>
                {/* Supplier info card */}
                <div className="smSupplierCard">
                  <div className="smSupplierCardInfo">
                    <p className="smSupplierCode">{supplier.supplier_code}</p>
                    <h2 className="smSupplierName">{supplier.company_name}</h2>
                    <p className="smSupplierMeta">
                      {[supplier.contact_name, supplier.phone, supplier.city].filter(Boolean).join(" · ") || "No contact details"}
                      {supplier.email ? ` · ${supplier.email}` : ""}
                      {!supplier.is_active ? " · Inactive" : ""}
                    </p>
                  </div>
                  <div className="smSupplierCardActions">
                    <button
                      type="button"
                      className="btn btnGhost smSmBtn"
                      onClick={() => editSupplierId === supplier.id ? setEditSupplierId(null) : startEditSupplier(supplier)}
                    >
                      {editSupplierId === supplier.id ? "Cancel" : "✎ Edit"}
                    </button>
                    <button
                      type="button"
                      className="btn btnGhost smSmBtn"
                      disabled={busy}
                      onClick={() => toggleSupplier(supplier.id, supplier.is_active)}
                    >
                      {supplier.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>

                {/* Edit supplier form */}
                {editSupplierId === supplier.id && (
                  <div className="supplierEditForm">
                    <div className="supplierEditFormGrid">
                      <label>Company name<input value={editSupplierData.company_name} onChange={e => setEditSupplierData((p: any) => ({ ...p, company_name: e.target.value }))} /></label>
                      <label>Contact person<input value={editSupplierData.contact_name} onChange={e => setEditSupplierData((p: any) => ({ ...p, contact_name: e.target.value }))} /></label>
                    </div>
                    <div className="supplierEditFormGrid">
                      <label>Phone<input value={editSupplierData.phone} onChange={e => setEditSupplierData((p: any) => ({ ...p, phone: e.target.value }))} /></label>
                      <label>WhatsApp<input value={editSupplierData.whatsapp} onChange={e => setEditSupplierData((p: any) => ({ ...p, whatsapp: e.target.value }))} /></label>
                    </div>
                    <div className="supplierEditFormGrid">
                      <label>Email<input value={editSupplierData.email} onChange={e => setEditSupplierData((p: any) => ({ ...p, email: e.target.value }))} /></label>
                      <label>City<input value={editSupplierData.city} onChange={e => setEditSupplierData((p: any) => ({ ...p, city: e.target.value }))} /></label>
                    </div>
                    <label>State<input value={editSupplierData.state} onChange={e => setEditSupplierData((p: any) => ({ ...p, state: e.target.value }))} /></label>
                    <label>Notes<textarea value={editSupplierData.notes} onChange={e => setEditSupplierData((p: any) => ({ ...p, notes: e.target.value }))} rows={2} /></label>
                    <div className="supplierEditFormActions">
                      <button type="button" className="btn btnGhost" onClick={() => setEditSupplierId(null)}>Cancel</button>
                      <button type="button" className="btn btnGold" disabled={busy} onClick={saveEditSupplier}>{busy ? "Saving…" : "Save Changes"}</button>
                    </div>
                  </div>
                )}

                {/* Equipment section */}
                <div className="smEquipSection">
                  <div className="smPanelHead">
                    <h3 className="smPanelTitle">Equipment <span className="smItemCountBadge">{supplierItems.length}</span></h3>
                    <button
                      className={`btn ${showAddItem ? "btnGhost" : "btnGold"} smAddBtn`}
                      onClick={() => { setShowAddItem(v => !v); setEditItemId(null); }}
                    >
                      {showAddItem ? "Cancel" : "+ Add Item"}
                    </button>
                  </div>

                  {showAddItem && (
                    <form className="smInlineForm" onSubmit={addSupplierItem}>
                      <div className="smFormGrid2">
                        <label>
                          Item name *
                          <input name="name" required placeholder="e.g. ARRI Alexa 35" autoFocus />
                        </label>
                        <label>
                          Category
                          <input name="category" placeholder="Cameras, Lenses, Lights…" />
                        </label>
                      </div>
                      <div className="smFormGrid3">
                        <label>Qty<input name="qty" type="number" min="0" step="1" defaultValue="1" /></label>
                        <label>Cost ₹<input name="cost" type="number" min="0" defaultValue="0" /></label>
                        <label>Basis<select name="basis" defaultValue="daily"><option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="flat">Flat</option></select></label>
                      </div>
                      <div className="smFormGrid2">
                        <label>Location<input name="location" placeholder={supplier.city || "Location"} /></label>
                        <label>Availability note<input name="availability" placeholder="Optional — call before confirming" /></label>
                      </div>
                      <label>
                        Match master catalog (optional)
                        <select name="catalog" defaultValue="">
                          <option value="">No match / custom item</option>
                          {catalog.map((x: any) => <option value={x.id} key={x.id}>{x.category} · {x.canonical_name}</option>)}
                        </select>
                      </label>
                      <div className="smFormActions">
                        <button type="button" className="btn btnGhost" onClick={() => setShowAddItem(false)}>Cancel</button>
                        <button type="submit" className="btn btnGold" disabled={busy}>{busy ? "Saving…" : "Add to Catalog"}</button>
                      </div>
                    </form>
                  )}

                  {supplierItems.length === 0 && !showAddItem && (
                    <p className="smEmpty">No equipment added yet. Click "+ Add Item" to start.</p>
                  )}
                  {supplierItems.map((x: any) => (
                    <div key={x.id}>
                      {editItemId === x.id ? (
                        <div className="itemEditRow">
                          <div className="itemEditRowGrid">
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#d8d2c7", display: "grid", gap: 4 }}>Item name<input value={editItemData.supplier_item_name} onChange={e => setEditItemData((p: any) => ({ ...p, supplier_item_name: e.target.value }))} /></label>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#d8d2c7", display: "grid", gap: 4 }}>Category<input value={editItemData.category} onChange={e => setEditItemData((p: any) => ({ ...p, category: e.target.value }))} /></label>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#d8d2c7", display: "grid", gap: 4 }}>Qty<input type="number" min="0" value={editItemData.quantity_available} onChange={e => setEditItemData((p: any) => ({ ...p, quantity_available: e.target.value }))} /></label>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#d8d2c7", display: "grid", gap: 4 }}>Cost ₹<input type="number" min="0" value={editItemData.default_cost_inr} onChange={e => setEditItemData((p: any) => ({ ...p, default_cost_inr: e.target.value }))} /></label>
                          </div>
                          <div className="itemEditRowGrid">
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#d8d2c7", display: "grid", gap: 4 }}>Basis<select value={editItemData.rate_basis} onChange={e => setEditItemData((p: any) => ({ ...p, rate_basis: e.target.value }))}><option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="flat">Flat</option></select></label>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#d8d2c7", display: "grid", gap: 4 }}>Location<input value={editItemData.location} onChange={e => setEditItemData((p: any) => ({ ...p, location: e.target.value }))} /></label>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#d8d2c7", display: "grid", gap: 4, gridColumn: "span 2" }}>Availability note<input value={editItemData.availability_notes} onChange={e => setEditItemData((p: any) => ({ ...p, availability_notes: e.target.value }))} /></label>
                          </div>
                          <div className="itemEditRowActions">
                            <button type="button" className="btn btnGhost" onClick={() => setEditItemId(null)}>Cancel</button>
                            <button type="button" className="btn btnGold" disabled={busy} onClick={saveEditItem}>{busy ? "Saving…" : "Save"}</button>
                          </div>
                        </div>
                      ) : (
                        <div className="smEquipRow">
                          <div className="smEquipRowInfo">
                            <b>{x.supplier_item_name}</b>
                            <span>{[x.category, x.location, x.availability_notes].filter(Boolean).join(" · ")}</span>
                          </div>
                          <span className="smEquipQty">×{x.quantity_available}</span>
                          <strong className="smEquipCost">{money(x.default_cost_inr)}<small>/{x.rate_basis}</small></strong>
                          <div className="smEquipActions">
                            <button className="editBtn" type="button" onClick={() => startEditItem(x)}>✎</button>
                            <button className="editBtn" type="button" onClick={() => removeItem(x.id)} style={{ color: "#ff8a8a" }}>×</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {message && <div className="errorBox" role="status" style={{ marginTop: 16 }}>{message}</div>}
    </>
  );
}
