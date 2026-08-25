"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function daysBetween(a: string, b: string) {
  if (!a || !b) return 1;
  return Math.max(1, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

type InventoryItem = {
  id: string;
  code: string;
  name: string;
  brand: string;
  category: string;
  type: "camera" | "accessory";
};
type Rate = { camera_id: string | null; accessory_id: string | null; daily_rate_inr: number; };
type CartItem = { item: InventoryItem; rate: number; };

export function QuickRentForm({
  cameras, accessories, rates,
}: {
  cameras: any[];
  accessories: any[];
  rates: Rate[];
}) {
  const supabase = createClient();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "camera" | "accessory">("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [unavailCams, setUnavailCams] = useState<Set<string>>(new Set());
  const [unavailAccs, setUnavailAccs] = useState<Set<string>>(new Set());
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);

  const days = daysBetween(startAt, endAt);

  useEffect(() => {
    if (!startAt || !endAt) { setUnavailCams(new Set()); setUnavailAccs(new Set()); return; }
    const start = new Date(startAt).toISOString();
    const end = new Date(endAt).toISOString();
    Promise.all([
      supabase.from("booking_cameras").select("camera_id, bookings!inner(start_at,end_at,status)")
        .neq("bookings.status", "cancelled").neq("bookings.status", "returned")
        .lt("bookings.start_at", end).gt("bookings.end_at", start),
      supabase.from("booking_accessories").select("accessory_id, bookings!inner(start_at,end_at,status)")
        .neq("bookings.status", "cancelled").neq("bookings.status", "returned")
        .lt("bookings.start_at", end).gt("bookings.end_at", start),
    ]).then(([{ data: cams }, { data: accs }]) => {
      setUnavailCams(new Set((cams || []).map((x: any) => x.camera_id)));
      setUnavailAccs(new Set((accs || []).map((x: any) => x.accessory_id)));
      // remove unavailable items from cart
      setCart(prev => prev.filter(c =>
        c.item.type === "camera" ? !(cams || []).some((x: any) => x.camera_id === c.item.id)
        : !(accs || []).some((x: any) => x.accessory_id === c.item.id)
      ));
    });
  }, [startAt, endAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const allItems: InventoryItem[] = useMemo(() => [
    ...cameras.map(c => ({
      id: c.id, code: c.camera_code, name: c.name,
      brand: c.manufacturer || "", category: "Camera", type: "camera" as const,
    })),
    ...accessories.map(a => ({
      id: a.id, code: a.accessory_code, name: a.name,
      brand: "", category: a.category || "Accessory", type: "accessory" as const,
    })),
  ], [cameras, accessories]);

  function getRate(item: InventoryItem): number {
    const r = item.type === "camera"
      ? rates.find(r => r.camera_id === item.id)
      : rates.find(r => r.accessory_id === item.id);
    return Number(r?.daily_rate_inr || 0);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allItems.filter(i => {
      if (filter === "camera" && i.type !== "camera") return false;
      if (filter === "accessory" && i.type !== "accessory") return false;
      if (!q) return true;
      return i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q) || i.brand.toLowerCase().includes(q) || i.category.toLowerCase().includes(q);
    });
  }, [allItems, search, filter]);

  function toggle(item: InventoryItem) {
    if (cart.find(c => c.item.id === item.id)) {
      setCart(prev => prev.filter(c => c.item.id !== item.id));
    } else {
      setCart(prev => [...prev, { item, rate: getRate(item) }]);
    }
  }

  function setRate(id: string, rate: number) {
    setCart(prev => prev.map(c => c.item.id === id ? { ...c, rate } : c));
  }

  const subtotal = cart.reduce((s, c) => s + c.rate * days, 0);

  async function checkout() {
    setErr("");
    if (!name.trim()) { setErr("Customer name is required."); return; }
    if (!startAt || !endAt) { setErr("Set rental dates."); return; }
    if (new Date(endAt) <= new Date(startAt)) { setErr("Return date must be after checkout date."); return; }
    if (cart.length === 0) { setErr("Add at least one item."); return; }
    setBusy(true);
    try {
      const { data: c, error: ce } = await supabase.from("customers").insert({
        name: name.trim(),
        company_name: company.trim() || null,
        phone: phone.trim() || null,
      }).select("id").single();
      if (ce) throw ce;

      const code = `BK-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const { data: b, error: be } = await supabase.from("bookings").insert({
        booking_code: code,
        customer_id: c.id,
        status: "confirmed",
        production_name: company.trim() || name.trim(),
        contact_name: name.trim(),
        contact_phone: phone.trim() || null,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        camera_charge_inr: subtotal,
        other_charges_inr: 0,
        discount_inr: 0,
      }).select("id").single();
      if (be) throw be;

      const camItems = cart.filter(c => c.item.type === "camera");
      const accItems = cart.filter(c => c.item.type === "accessory");

      if (camItems.length) {
        const { error } = await supabase.from("booking_cameras").insert(
          camItems.map(c => ({ booking_id: b.id, camera_id: c.item.id }))
        );
        if (error) throw error;
      }
      if (accItems.length) {
        const { error } = await supabase.from("booking_accessories").insert(
          accItems.map(c => ({ booking_id: b.id, accessory_id: c.item.id, quantity: 1 }))
        );
        if (error) throw error;
      }

      router.push(`/admin/operations?booking=${b.id}`);
    } catch (e: any) {
      setErr(e?.message || e?.details || "Checkout failed.");
      setBusy(false);
    }
  }

  return (
    <div className="quickRentShell">

      {/* LEFT — catalog */}
      <div className="quickRentCatalog">
        <input
          className="quickRentSearch"
          placeholder="Search cameras, lenses, lights, grip…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        <div className="quickRentFilters">
          {(["all", "camera", "accessory"] as const).map(f => (
            <button key={f} type="button" className={`quickRentFilter${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "camera" ? "Cameras" : "Accessories"}
            </button>
          ))}
        </div>
        <div className="quickRentList">
          {filtered.length === 0 && <p className="quickRentEmpty">No items match.</p>}
          {filtered.map(item => {
            const inCart = cart.some(c => c.item.id === item.id);
            const rate = getRate(item);
            const unavailable = item.type === "camera" ? unavailCams.has(item.id) : unavailAccs.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={`quickRentItem${inCart ? " inCart" : ""}${unavailable ? " unavailable" : ""}`}
                onClick={() => !unavailable && toggle(item)}
                disabled={unavailable}
                title={unavailable ? "Already booked for these dates" : undefined}
              >
                <div className="quickRentItemInfo">
                  <b>{item.name}</b>
                  <span>{item.code} · {item.category}{item.brand ? ` · ${item.brand}` : ""}</span>
                </div>
                <div className="quickRentItemRight">
                  <span className="quickRentRate">{unavailable ? "Booked" : rate > 0 ? `${money(rate)}/day` : "—"}</span>
                  <span className="quickRentAddBtn">{unavailable ? "✕" : inCart ? "✓" : "+"}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT — cart + form */}
      <div className="quickRentPanel">

        <div className="quickRentSection">
          <p className="quickRentSectionLabel">CUSTOMER</p>
          <div className="quickRentGrid2">
            <label className="quickRentLabel">
              Name *
              <input className="quickRentInput" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
            </label>
            <label className="quickRentLabel">
              Phone
              <input className="quickRentInput" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 …" />
            </label>
          </div>
          <label className="quickRentLabel">
            Company / Production
            <input className="quickRentInput" value={company} onChange={e => setCompany(e.target.value)} placeholder="Optional" />
          </label>
        </div>

        <div className="quickRentSection">
          <p className="quickRentSectionLabel">DATES</p>
          <div className="quickRentGrid2">
            <label className="quickRentLabel">
              Checkout *
              <div className="newReqDateWrap" onClick={() => startRef.current?.showPicker()}>
                <span className="newReqDateIcon">📅</span>
                <input ref={startRef} type="date" className="newReqDateInput" value={startAt} onChange={e => setStartAt(e.target.value)} />
              </div>
            </label>
            <label className="quickRentLabel">
              Return *
              <div className="newReqDateWrap" onClick={() => endRef.current?.showPicker()}>
                <span className="newReqDateIcon">📅</span>
                <input ref={endRef} type="date" className="newReqDateInput" value={endAt} min={startAt} onChange={e => setEndAt(e.target.value)} />
              </div>
            </label>
          </div>
          {startAt && endAt && <p className="quickRentDays">{days} day{days !== 1 ? "s" : ""}</p>}
        </div>

        <div className="quickRentSection quickRentCartSection">
          <p className="quickRentSectionLabel">SELECTED {cart.length > 0 && `· ${cart.length} item${cart.length > 1 ? "s" : ""}`}</p>
          {cart.length === 0
            ? <p className="quickRentEmpty">Tap any item on the left to add it.</p>
            : <>
                {cart.map(({ item, rate }) => (
                  <div key={item.id} className="quickRentCartItem">
                    <div className="quickRentCartInfo">
                      <b>{item.name}</b>
                      <span>{item.code} · {item.category}</span>
                    </div>
                    <div className="quickRentCartRight">
                      <label className="quickRentRateLabel">
                        ₹<input
                          type="number"
                          min="0"
                          value={rate}
                          onChange={e => setRate(item.id, Number(e.target.value))}
                          className="quickRentRateInput"
                        />/day
                      </label>
                      <span className="quickRentLineTotal">{money(rate * days)}</span>
                      <button type="button" className="quickRentRemove" onClick={() => toggle(item)}>×</button>
                    </div>
                  </div>
                ))}
              </>
          }
        </div>

        {err && <p className="studioError" style={{ margin: "0 16px" }}>{err}</p>}

        <div className="quickRentFooter">
          <div className="quickRentTotal">
            <span>Total</span>
            <b>{money(subtotal)}</b>
            {startAt && endAt && cart.length > 0 && (
              <span className="quickRentTotalDays">for {days} day{days !== 1 ? "s" : ""}</span>
            )}
          </div>
          <button
            type="button"
            className="btn btnGold quickRentCheckout"
            disabled={busy}
            onClick={() => void checkout()}
          >
            {busy ? "Creating booking…" : "Check Out →"}
          </button>
        </div>
      </div>
    </div>
  );
}
