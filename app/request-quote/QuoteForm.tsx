"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DateTimePicker } from "@/components/DateTimePicker";

type EquipmentAsset = {
  asset_type: "camera" | "accessory";
  asset_id: string;
  name: string;
  category: string | null;
  brand: string | null;
  model: string | null;
  available: boolean;
};

type EquipmentGroup = {
  key: string;
  assetType: "camera" | "accessory";
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  availableIds: string[];
  unavailableCount: number;
  totalCount: number;
};

const CATEGORY_ORDER = [
  "Cameras",
  "Lenses",
  "Lights",
  "Audio",
  "Grip & Movement",
  "Accessories",
  "Transport",
  "Gensets",
  "Post Production",
  "Other",
];

function localMin() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function publicCategory(asset: EquipmentAsset) {
  if (asset.asset_type === "camera") return "Cameras";
  const raw = (asset.category || "Other").trim().toLowerCase();
  if (raw === "lens" || raw === "lenses") return "Lenses";
  if (raw === "light" || raw === "lighting" || raw === "aputure") return "Lights";
  if (raw === "audio" || raw === "microphone") return "Audio";
  if (["grip", "board", "grip / movement", "gimbal", "tripod"].includes(raw)) return "Grip & Movement";
  if (["camera accessory", "wireless video", "accessory", "accessories"].includes(raw)) return "Accessories";
  if (raw === "transport") return "Transport";
  if (["generator", "genset", "generator / genset"].includes(raw)) return "Gensets";
  if (["post production", "post-production", "post production studio"].includes(raw)) return "Post Production";
  return asset.category || "Other";
}

function publicName(name: string) {
  // Physical assets are serialized internally (#1, #2, etc.). Customers pick the product/model and quantity.
  return name.replace(/\s+#\d+\s*$/i, "").trim();
}

function buildGroups(assets: EquipmentAsset[]) {
  const map = new Map<string, EquipmentGroup>();

  for (const asset of assets) {
    const category = publicCategory(asset);
    const name = publicName(asset.name);
    const key = `${asset.asset_type}|${category}|${name.toLowerCase()}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        key,
        assetType: asset.asset_type,
        name,
        category,
        brand: asset.brand,
        model: asset.model,
        availableIds: asset.available ? [asset.asset_id] : [],
        unavailableCount: asset.available ? 0 : 1,
        totalCount: 1,
      });
      continue;
    }

    existing.totalCount += 1;
    if (asset.available) existing.availableIds.push(asset.asset_id);
    else existing.unavailableCount += 1;
    if (!existing.brand && asset.brand) existing.brand = asset.brand;
    if (!existing.model && asset.model) existing.model = asset.model;
  }

  return Array.from(map.values()).sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category);
    const bi = CATEGORY_ORDER.indexOf(b.category);
    const aOrder = ai === -1 ? CATEGORY_ORDER.length : ai;
    const bOrder = bi === -1 ? CATEGORY_ORDER.length : bi;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name);
  });
}

export default function QuoteForm() {
  const [assets, setAssets] = useState<EquipmentAsset[]>([]);
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [showSelection, setShowSelection] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [datesChecked, setDatesChecked] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const minDate = useMemo(() => localMin(), []);
  const contactRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const groups = useMemo(() => buildGroups(assets), [assets]);

  const categories = useMemo(() => {
    const present = new Set(groups.map((group) => group.category));
    const ordered = CATEGORY_ORDER.filter((category) => present.has(category));
    const extras = Array.from(present)
      .filter((category) => !CATEGORY_ORDER.includes(category))
      .sort();
    return ["All", ...ordered, ...extras];
  }, [groups]);

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return groups.filter((group) => {
      if (activeCategory !== "All" && group.category !== activeCategory) return false;
      if (!term) return true;
      return [group.name, group.category, group.brand || "", group.model || ""]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [groups, activeCategory, search]);

  const groupsByCategory = useMemo(() => {
    const map = new Map<string, EquipmentGroup[]>();
    for (const group of filteredGroups) {
      const list = map.get(group.category) || [];
      list.push(group);
      map.set(group.category, list);
    }
    return map;
  }, [filteredGroups]);

  const selectedGroups = useMemo(
    () => groups.filter((group) => (selectedQty[group.key] || 0) > 0),
    [groups, selectedQty],
  );

  const selectedItemCount = useMemo(
    () => selectedGroups.reduce((sum, group) => sum + (selectedQty[group.key] || 0), 0),
    [selectedGroups, selectedQty],
  );

  function validPeriod(s: string, e: string) {
    if (!s || !e) return false;
    const startDate = new Date(s);
    const endDate = new Date(e);
    const now = new Date();
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return false;
    if (startDate < now) return false;
    return endDate > startDate;
  }

  async function availability(s = start, e = end) {
    setSuccess(false);
    if (!s || !e) {
      setAssets([]);
      setSelectedQty({});
      setDatesChecked(false);
      return;
    }

    if (!validPeriod(s, e)) {
      setAssets([]);
      setSelectedQty({});
      setDatesChecked(false);
      setMessage("Choose a future start time and a return time after the start.");
      return;
    }

    setCheckingAvailability(true);
    setMessage("");
    setDatesChecked(true);

    try {
      const { data, error } = await supabase.rpc("public_equipment_availability", {
        p_start: new Date(s).toISOString(),
        p_end: new Date(e).toISOString(),
      });

      if (error) {
        setAssets([]);
        setSelectedQty({});
        setMessage(error.message);
        return;
      }

      setAssets((data || []) as EquipmentAsset[]);
      setSelectedQty({});
      setActiveCategory("All");
      setSearch("");
      setShowSelection(false);
    } catch (err) {
      setAssets([]);
      setSelectedQty({});
      setMessage(err instanceof Error ? err.message : "Unable to check equipment availability.");
    } finally {
      setCheckingAvailability(false);
    }
  }

  function setQuantity(group: EquipmentGroup, next: number) {
    const safe = Math.max(0, Math.min(group.availableIds.length, next));
    setSelectedQty((current) => {
      const updated = { ...current };
      if (safe === 0) delete updated[group.key];
      else updated[group.key] = safe;
      return updated;
    });
  }

  function toggleGroup(group: EquipmentGroup) {
    if (group.availableIds.length === 0) return;
    const current = selectedQty[group.key] || 0;
    setQuantity(group, current > 0 ? 0 : 1);
  }

  function clearSelection() {
    setSelectedQty({});
    setShowSelection(false);
  }

  function continueToContact() {
    contactRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (loading) return;

    const form = ev.currentTarget;

    if (!validPeriod(start, end)) {
      setMessage("Choose a future start time and a return time after the start.");
      setSuccess(false);
      return;
    }

    setLoading(true);
    setMessage("");
    setSuccess(false);

    try {
      const f = new FormData(form);
      const requestedCameraIds: string[] = [];
      const requestedAccessoryIds: string[] = [];

      for (const group of selectedGroups) {
        const quantity = selectedQty[group.key] || 0;
        const ids = group.availableIds.slice(0, quantity);
        if (group.assetType === "camera") requestedCameraIds.push(...ids);
        else requestedAccessoryIds.push(...ids);
      }

      const { data, error } = await supabase.rpc("submit_quote_request_v2", {
        p_name: String(f.get("name") || ""),
        p_company_name: String(f.get("client") || ""),
        p_phone: String(f.get("phone") || ""),
        p_project_name: String(f.get("project") || ""),
        p_start: new Date(start).toISOString(),
        p_end: new Date(end).toISOString(),
        p_requested_camera_ids: requestedCameraIds,
        p_requested_accessory_ids: requestedAccessoryIds,
        p_requested_kit_ids: [],
        p_notes: String(f.get("notes") || ""),
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage(`Request ${data} received. Sri Cine Hub will confirm availability and pricing.`);
      setSuccess(true);

      form.reset();
      setSelectedQty({});
      setAssets([]);
      setStart("");
      setEnd("");
      setDatesChecked(false);
      setSearch("");
      setActiveCategory("All");
      setShowSelection(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to submit your request.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="quoteForm equipmentQuoteForm" onSubmit={submit}>
      <div className="formGrid">
        <label>
          Production / Client *
          <input required name="client" maxLength={120} />
        </label>
        <label>
          Project *
          <input required name="project" maxLength={160} />
        </label>
      </div>

      <div className="formGrid dateGrid">
        <DateTimePicker
          label="Start"
          value={start}
          min={minDate}
          onChange={(v) => {
            setStart(v);
            void availability(v, end);
          }}
        />
        <DateTimePicker
          label="Return"
          value={end}
          min={start || minDate}
          onChange={(v) => {
            setEnd(v);
            void availability(start, v);
          }}
        />
      </div>

      <section className="equipmentPicker" aria-label="Select equipment">
        <div className="equipmentPickerHead">
          <div>
            <b>Select Equipment</b>
            <p className="formNote">Search or browse by category. Rates stay private.</p>
          </div>
          {datesChecked && !checkingAvailability && (
            <span className="equipmentCount">{groups.length} equipment types</span>
          )}
        </div>

        {checkingAvailability && <p className="formNote">Checking equipment availability…</p>}

        {!checkingAvailability && !datesChecked && (
          <p className="formNote">
            Choose start and return dates to see equipment available for your rental period.
          </p>
        )}

        {!checkingAvailability && datesChecked && groups.length === 0 && (
          <p className="formNote">No public equipment is currently configured for these dates.</p>
        )}

        {!checkingAvailability && datesChecked && groups.length > 0 && (
          <>
            <div className="equipmentTools">
              <div className="equipmentSearch">
                <span aria-hidden="true">⌕</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search cameras, lenses, lights, grip…"
                  aria-label="Search equipment"
                />
                {search && (
                  <button type="button" className="searchClear" onClick={() => setSearch("")} aria-label="Clear search">
                    ×
                  </button>
                )}
              </div>

              <div className="categoryTabs" role="tablist" aria-label="Equipment categories">
                {categories.map((category) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === category}
                    className={`categoryTab ${activeCategory === category ? "active" : ""}`}
                    key={category}
                    onClick={() => setActiveCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div className="equipmentResults">
              {filteredGroups.length === 0 && (
                <div className="emptyEquipmentSearch">No equipment matches your search.</div>
              )}

              {Array.from(groupsByCategory.entries()).map(([category, categoryGroups]) => (
                <section className="equipmentCategory" key={category}>
                  <div className="equipmentCategoryHead">
                    <h3>{category}</h3>
                    <span>{categoryGroups.length} items</span>
                  </div>

                  <div className="equipmentList">
                    {categoryGroups.map((group) => {
                      const quantity = selectedQty[group.key] || 0;
                      const availableCount = group.availableIds.length;
                      const selected = quantity > 0;
                      return (
                        <div
                          key={group.key}
                          className={`equipmentPickRow ${selected ? "selected" : ""} ${availableCount === 0 ? "unavailable" : ""}`}
                          onClick={() => toggleGroup(group)}
                          role="button"
                          tabIndex={availableCount > 0 ? 0 : -1}
                          onKeyDown={(e) => {
                            if (availableCount > 0 && (e.key === "Enter" || e.key === " ")) {
                              e.preventDefault();
                              toggleGroup(group);
                            }
                          }}
                          aria-disabled={availableCount === 0}
                        >
                          <div className={`equipmentCheck ${selected ? "checked" : ""}`} aria-hidden="true">
                            {selected ? "✓" : ""}
                          </div>
                          <div className="equipmentPickInfo">
                            <strong>{group.name}</strong>
                            <span>
                              {[group.brand, group.model].filter(Boolean).join(" · ") || group.category}
                            </span>
                          </div>
                          <div className="equipmentAvailability">
                            <span className={availableCount > 0 ? "availableDot" : "unavailableDot"} />
                            {availableCount > 0
                              ? availableCount === 1
                                ? "Available"
                                : `${availableCount} available`
                              : "Unavailable"}
                          </div>

                          {availableCount > 1 && selected && (
                            <div className="quantityControl" onClick={(e) => e.stopPropagation()}>
                              <button type="button" onClick={() => setQuantity(group, quantity - 1)} aria-label={`Reduce ${group.name} quantity`}>
                                −
                              </button>
                              <b>{quantity}</b>
                              <button
                                type="button"
                                disabled={quantity >= availableCount}
                                onClick={() => setQuantity(group, quantity + 1)}
                                aria-label={`Increase ${group.name} quantity`}
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </section>

      {selectedItemCount > 0 && (
        <div className="selectionDock">
          {showSelection && (
            <div className="selectionDrawer">
              <div className="selectionDrawerHead">
                <b>Your equipment</b>
                <button type="button" onClick={() => setShowSelection(false)}>Close</button>
              </div>
              {selectedGroups.map((group) => (
                <div className="selectionLine" key={group.key}>
                  <span>{group.name}</span>
                  <div>
                    <b>× {selectedQty[group.key]}</b>
                    <button type="button" onClick={() => setQuantity(group, 0)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="selectionDockBar">
            <div>
              <b>{selectedItemCount} {selectedItemCount === 1 ? "item" : "items"} selected</b>
              <span>{selectedGroups.slice(0, 2).map((group) => group.name).join(" · ")}{selectedGroups.length > 2 ? ` +${selectedGroups.length - 2} more` : ""}</span>
            </div>
            <div className="selectionDockActions">
              <button type="button" className="dockTextButton" onClick={clearSelection}>Clear</button>
              <button type="button" className="dockTextButton" onClick={() => setShowSelection((value) => !value)}>View Selection</button>
              <button type="button" className="button gold" onClick={continueToContact}>Continue →</button>
            </div>
          </div>
        </div>
      )}

      <div ref={contactRef} className="quoteContactStep">
        <div className="quoteStepHeading">
          <span>CONTACT & NOTES</span>
          <h2>Where should we send the quote?</h2>
        </div>

        <div className="formGrid">
          <label>
            Contact name *
            <input required name="name" minLength={2} maxLength={120} />
          </label>
          <label>
            Phone / WhatsApp *
            <input required name="phone" minLength={6} maxLength={30} inputMode="tel" />
          </label>
        </div>

        <label>
          Anything else you need?
          <textarea
            name="notes"
            rows={5}
            maxLength={2000}
            placeholder="Crew, special lens, monitor, wireless video, transport, post-production, or anything not listed above…"
          />
        </label>

        <div className="submitQuoteRow">
          <div>
            <b>{selectedItemCount > 0 ? `${selectedItemCount} equipment item${selectedItemCount === 1 ? "" : "s"} selected` : "No exact equipment selected"}</b>
            <span>You can still describe your requirements in the box above.</span>
          </div>
          <button className="button gold" disabled={loading} type="submit">
            {loading ? "Submitting…" : "Request availability & quote"}
          </button>
        </div>
      </div>

      {message && (
        <div className={success ? "successBox" : "errorBox"} role="status" aria-live="polite">
          {message}
        </div>
      )}

      <p className="formNote">Rates are internal. No payment is collected here.</p>
      {loading&&<div className="actionOverlay" role="status" aria-live="polite">
        <div className="actionOverlayCard"><span className="loadingSpinner"/><b>Submitting quote request…</b><small>We’re saving your equipment selection and rental dates.</small></div>
      </div>}
    </form>
  );
}
