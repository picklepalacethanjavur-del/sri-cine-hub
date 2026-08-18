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

  const supplier = suppliers.find((x: any) => x.id === selected);
  const supplierItems = items.filter((x: any) => x.supplier_id === selected);
  const filtered = suppliers.filter((x: any) =>
    `${x.company_name} ${x.city || ""} ${x.contact_name || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  // Reverse lookup: all items annotated with supplier info, filtered by search
  const lookupResults = useMemo(() => {
    if (!lookupSearch.trim()) return [];
    const q = lookupSearch.toLowerCase();
    return items
      .filter((x: any) => `${x.supplier_item_name} ${x.category || ""}`.toLowerCase().includes(q))
      .map((x: any) => ({ ...x, supplier: suppliers.find((s: any) => s.id === x.supplier_id) }));
  }, [lookupSearch, items, suppliers]);

  // Group reverse lookup by item name for display
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
      form.reset();
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to create supplier.");
    } finally {
      setBusy(false);
    }
  }

  async function addCatalogModel(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true); setMessage("");
    try {
      const { error } = await supabase.from("master_equipment_catalog").insert({
        canonical_name: String(f.get("name") || "").trim(),
        category: String(f.get("category") || "Other").trim() || "Other",
        manufacturer: String(f.get("manufacturer") || "").trim() || null,
        model: String(f.get("model") || "").trim() || null,
      });
      if (error) throw error;
      form.reset();
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to add equipment model.");
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
    if (!confirm("Remove this supplier catalog item?")) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.from("supplier_catalog_items").delete().eq("id", id);
    if (error) setMessage(error.message);
    else router.refresh();
    setBusy(false);
  }

  return (
    <>
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

      {/* ── REVERSE LOOKUP MODE ── */}
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
                <div className="lookupItemName">
                  {name}
                  <span>{category}</span>
                </div>
                {rows.map((row: any) => (
                  <div key={row.id} className="lookupSupplierRow">
                    <div className="lookupSupplierInfo">
                      <b>{row.supplier?.company_name || "Unknown supplier"}</b>
                      <span>
                        {[row.supplier?.contact_name, row.supplier?.phone, row.supplier?.city].filter(Boolean).join(" · ")}
                        {row.availability_notes ? ` — ${row.availability_notes}` : ""}
                      </span>
                    </div>
                    <div className="lookupSupplierMeta">
                      <b>{money(row.default_cost_inr)}/{row.rate_basis}</b>
                      <span>Qty: {row.quantity_available}{row.location ? ` · ${row.location}` : ""}</span>
                    </div>
                    <button
                      className="editBtn"
                      onClick={() => { setMode("suppliers"); setSelected(row.supplier_id); startEditItem(row); }}
                    >✎</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SUPPLIER DIRECTORY MODE ── */}
      {mode === "suppliers" && (
        <div className="supplierWorkspace">
          <aside className="supplierListPanel">
            <div className="supplierListHead">
              <h2>Suppliers</h2>
              <label>
                Search suppliers
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Company, city or contact" />
              </label>
            </div>
            <div className="supplierList">
              {filtered.map((s: any) => (
                <button type="button" key={s.id} className={selected === s.id ? "active" : ""} onClick={() => { setSelected(s.id); setEditSupplierId(null); setEditItemId(null); }}>
                  <div>
                    <b>{s.company_name}</b>
                    <span>{[s.city, s.contact_name].filter(Boolean).join(" · ") || "No contact details"}</span>
                  </div>
                  <em>{items.filter((x: any) => x.supplier_id === s.id).length} items</em>
                </button>
              ))}
            </div>
            <details className="supplierAddDetails">
              <summary>+ Add Supplier</summary>
              <form onSubmit={addSupplier}>
                <label>Company name<input required name="company" /></label>
                <div className="formGrid">
                  <label>Contact person<input name="contact" /></label>
                  <label>Phone<input name="phone" /></label>
                </div>
                <div className="formGrid">
                  <label>WhatsApp<input name="whatsapp" /></label>
                  <label>Email<input name="email" type="email" /></label>
                </div>
                <div className="formGrid">
                  <label>City<input name="city" /></label>
                  <label>State<input name="state" /></label>
                </div>
                <label>Notes<textarea name="notes" /></label>
                <button type="submit" className="button gold" disabled={busy}>{busy ? "Saving…" : "Add Supplier"}</button>
              </form>
            </details>
          </aside>

          <section className="supplierDetailPanel">
            {supplier ? (
              <>
                {/* Supplier header */}
                <div className="supplierTitle">
                  <div>
                    <span>{supplier.supplier_code}</span>
                    <h2>{supplier.company_name}</h2>
                    <p>{[supplier.contact_name, supplier.phone, supplier.city].filter(Boolean).join(" · ") || "Supplier profile"}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="editBtn" onClick={() => editSupplierId === supplier.id ? setEditSupplierId(null) : startEditSupplier(supplier)}>
                      {editSupplierId === supplier.id ? "Cancel" : "✎ Edit"}
                    </button>
                    <button type="button" className="button ghost" disabled={busy} onClick={() => toggleSupplier(supplier.id, supplier.is_active)}>
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
                      <button type="button" className="button ghost" onClick={() => setEditSupplierId(null)}>Cancel</button>
                      <button type="button" className="button gold" disabled={busy} onClick={saveEditSupplier}>{busy ? "Saving…" : "Save Changes"}</button>
                    </div>
                  </div>
                )}

                {/* Catalog items table */}
                <div className="supplierCatalogTable">
                  <div className="supplierCatalogHeader">
                    <span>Equipment</span><span>Qty</span><span>Our Cost</span><span>Basis</span><span>Action</span>
                  </div>
                  {supplierItems.length ? supplierItems.map((x: any) => (
                    <div key={x.id}>
                      {editItemId === x.id ? (
                        <div className="itemEditRow">
                          <div className="itemEditRowGrid">
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#d8d2c7", display: "grid", gap: 4 }}>
                              Item name
                              <input value={editItemData.supplier_item_name} onChange={e => setEditItemData((p: any) => ({ ...p, supplier_item_name: e.target.value }))} />
                            </label>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#d8d2c7", display: "grid", gap: 4 }}>
                              Category
                              <input value={editItemData.category} onChange={e => setEditItemData((p: any) => ({ ...p, category: e.target.value }))} />
                            </label>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#d8d2c7", display: "grid", gap: 4 }}>
                              Qty
                              <input type="number" min="0" value={editItemData.quantity_available} onChange={e => setEditItemData((p: any) => ({ ...p, quantity_available: e.target.value }))} />
                            </label>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#d8d2c7", display: "grid", gap: 4 }}>
                              Cost ₹
                              <input type="number" min="0" value={editItemData.default_cost_inr} onChange={e => setEditItemData((p: any) => ({ ...p, default_cost_inr: e.target.value }))} />
                            </label>
                          </div>
                          <div className="itemEditRowGrid">
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#d8d2c7", display: "grid", gap: 4 }}>
                              Basis
                              <select value={editItemData.rate_basis} onChange={e => setEditItemData((p: any) => ({ ...p, rate_basis: e.target.value }))}>
                                <option value="hourly">Hourly</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="flat">Flat</option>
                              </select>
                            </label>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#d8d2c7", display: "grid", gap: 4 }}>
                              Location
                              <input value={editItemData.location} onChange={e => setEditItemData((p: any) => ({ ...p, location: e.target.value }))} />
                            </label>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#d8d2c7", display: "grid", gap: 4, gridColumn: "span 2" }}>
                              Availability note
                              <input value={editItemData.availability_notes} onChange={e => setEditItemData((p: any) => ({ ...p, availability_notes: e.target.value }))} />
                            </label>
                          </div>
                          <div className="itemEditRowActions">
                            <button type="button" className="button ghost" onClick={() => setEditItemId(null)}>Cancel</button>
                            <button type="button" className="button gold" disabled={busy} onClick={saveEditItem}>{busy ? "Saving…" : "Save Item"}</button>
                          </div>
                        </div>
                      ) : (
                        <div className="supplierCatalogRow">
                          <div>
                            <b>{x.supplier_item_name}</b>
                            <span>{x.category}{x.location ? ` · ${x.location}` : ""}{x.availability_notes ? ` · ${x.availability_notes}` : ""}</span>
                          </div>
                          <span>{Number(x.quantity_available || 0)}</span>
                          <strong>{money(x.default_cost_inr)}</strong>
                          <span>{x.rate_basis}</span>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="editBtn" type="button" onClick={() => startEditItem(x)} aria-label="Edit">✎</button>
                            <button className="iconButton danger" type="button" onClick={() => removeItem(x.id)} aria-label={`Remove ${x.supplier_item_name}`}>×</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )) : (
                    <div className="supplierEmpty">No equipment added to this supplier yet.</div>
                  )}
                </div>

                <details className="supplierCatalogAdd" open={supplierItems.length === 0}>
                  <summary>+ Add Equipment to {supplier.company_name}</summary>
                  <form onSubmit={addSupplierItem}>
                    <label>
                      Match master equipment
                      <select name="catalog" defaultValue="">
                        <option value="">No master match / custom item</option>
                        {catalog.map((x: any) => <option value={x.id} key={x.id}>{x.category} · {x.canonical_name}</option>)}
                      </select>
                    </label>
                    <div className="formGrid">
                      <label>Supplier item name<input name="name" placeholder="Optional when master item is selected" /></label>
                      <label>Category<input name="category" placeholder="Camera, Lenses, Lights…" /></label>
                    </div>
                    <div className="formGrid">
                      <label>Available quantity<input name="qty" type="number" min="0" step="1" defaultValue="1" /></label>
                      <label>Normal supplier cost ₹<input name="cost" type="number" min="0" defaultValue="0" /></label>
                    </div>
                    <div className="formGrid">
                      <label>
                        Cost basis
                        <select name="basis" defaultValue="daily">
                          <option value="hourly">Hourly</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="flat">Flat</option>
                        </select>
                      </label>
                      <label>Location<input name="location" placeholder={supplier.city || "Location"} /></label>
                    </div>
                    <label>Availability note<input name="availability" placeholder="Optional — call before confirming, weekends only, etc." /></label>
                    <button type="submit" className="button gold" disabled={busy}>{busy ? "Saving equipment…" : "Add to Supplier Catalog"}</button>
                  </form>
                </details>
              </>
            ) : (
              <div className="supplierEmpty">Add or select a supplier.</div>
            )}
          </section>
        </div>
      )}

      <details className="masterCatalogQuickAdd">
        <summary>+ Add New Equipment Model to Master Catalog</summary>
        <form onSubmit={addCatalogModel}>
          <div className="formGrid">
            <label>Canonical equipment name<input required name="name" placeholder="Cooke S7/i FF Lens Set" /></label>
            <label>Category<input required name="category" placeholder="Lenses" /></label>
          </div>
          <div className="formGrid">
            <label>Manufacturer<input name="manufacturer" /></label>
            <label>Model<input name="model" /></label>
          </div>
          <button type="submit" className="button gold" disabled={busy}>{busy ? "Saving model…" : "Add Master Equipment"}</button>
        </form>
      </details>

      {message && <div className="errorBox" role="status">{message}</div>}
    </>
  );
}
