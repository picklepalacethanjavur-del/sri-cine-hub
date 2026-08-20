"use client";
import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function daysBetween(a: string, b: string) {
  if (!a || !b) return 1;
  return Math.max(1, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

type Camera = { id: string; camera_code: string; name: string; manufacturer: string; catalog_item_id: string | null; };
type CartItem = { cameraId: string; code: string; name: string; rate: number; };

export function QuickRentForm({ cameras, rates }: { cameras: Camera[]; rates: any[] }) {
  const supabase = createClient();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const days = daysBetween(startAt, endAt);

  function defaultRate(cam: Camera) {
    if (!cam.catalog_item_id) return 0;
    const r = rates.find((r: any) => r.catalog_item_id === cam.catalog_item_id);
    return Number(r?.daily_rate_inr || 0);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return cameras;
    return cameras.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.camera_code.toLowerCase().includes(q) ||
      (c.manufacturer || "").toLowerCase().includes(q)
    );
  }, [cameras, search]);

  function toggle(cam: Camera) {
    if (cart.find(i => i.cameraId === cam.id)) {
      setCart(prev => prev.filter(i => i.cameraId !== cam.id));
    } else {
      setCart(prev => [...prev, { cameraId: cam.id, code: cam.camera_code, name: cam.name, rate: defaultRate(cam) }]);
    }
  }

  function setRate(id: string, rate: number) {
    setCart(prev => prev.map(i => i.cameraId === id ? { ...i, rate } : i));
  }

  const total = cart.reduce((s, i) => s + i.rate * days, 0);

  async function checkout() {
    setErr("");
    if (!name.trim()) { setErr("Customer name is required."); return; }
    if (!startAt || !endAt) { setErr("Set rental dates."); return; }
    if (new Date(endAt) <= new Date(startAt)) { setErr("Return date must be after checkout date."); return; }
    if (cart.length === 0) { setErr("Add at least one camera."); return; }
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
        status: "active",
        production_name: company.trim() || name.trim(),
        contact_name: name.trim(),
        contact_phone: phone.trim() || null,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        camera_charge_inr: total,
        other_charges_inr: 0,
        discount_inr: 0,
      }).select("id").single();
      if (be) throw be;

      const { error: ae } = await supabase.from("booking_cameras").insert(
        cart.map(i => ({ booking_id: b.id, camera_id: i.cameraId }))
      );
      if (ae) throw ae;

      router.push(`/admin/bookings/${b.id}`);
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
          placeholder="Search cameras, brand…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        <div className="quickRentList">
          {filtered.length === 0 && <p className="quickRentEmpty">No cameras match.</p>}
          {filtered.map(cam => {
            const inCart = cart.some(i => i.cameraId === cam.id);
            const rate = defaultRate(cam);
            return (
              <button
                key={cam.id}
                type="button"
                className={`quickRentItem${inCart ? " inCart" : ""}`}
                onClick={() => toggle(cam)}
              >
                <div className="quickRentItemInfo">
                  <b>{cam.name}</b>
                  <span>{cam.camera_code} · {cam.manufacturer}</span>
                </div>
                <div className="quickRentItemRight">
                  {rate > 0 && <span className="quickRentRate">{money(rate)}/day</span>}
                  <span className="quickRentAddBtn">{inCart ? "✓" : "+"}</span>
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
              <input type="date" className="quickRentInput" value={startAt} onChange={e => setStartAt(e.target.value)} />
            </label>
            <label className="quickRentLabel">
              Return *
              <input type="date" className="quickRentInput" value={endAt} min={startAt} onChange={e => setEndAt(e.target.value)} />
            </label>
          </div>
          {startAt && endAt && <p className="quickRentDays">{days} day{days !== 1 ? "s" : ""}</p>}
        </div>

        <div className="quickRentSection quickRentCartSection">
          <p className="quickRentSectionLabel">CART {cart.length > 0 && `· ${cart.length} camera${cart.length > 1 ? "s" : ""}`}</p>
          {cart.length === 0
            ? <p className="quickRentEmpty">Tap a camera on the left to add it.</p>
            : cart.map(item => (
              <div key={item.cameraId} className="quickRentCartItem">
                <div className="quickRentCartInfo">
                  <b>{item.name}</b>
                  <span>{item.code}</span>
                </div>
                <div className="quickRentCartRight">
                  <label className="quickRentRateLabel">
                    ₹<input
                      type="number"
                      min="0"
                      value={item.rate}
                      onChange={e => setRate(item.cameraId, Number(e.target.value))}
                      className="quickRentRateInput"
                    />/day
                  </label>
                  <span className="quickRentLineTotal">{money(item.rate * days)}</span>
                  <button type="button" className="quickRentRemove" onClick={() => toggle({ id: item.cameraId } as any)}>×</button>
                </div>
              </div>
            ))
          }
        </div>

        {err && <p className="studioError">{err}</p>}

        <div className="quickRentFooter">
          <div className="quickRentTotal">
            <span>Total</span>
            <b>{money(total)}</b>
            {startAt && endAt && <span className="quickRentTotalDays">for {days} day{days !== 1 ? "s" : ""}</span>}
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
