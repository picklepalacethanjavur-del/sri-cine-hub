"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const calcDays = (start: string, end: string) =>
  Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000));
const todayStr = () => new Date().toISOString().slice(0, 10);

export function BookingEquipment({ booking, rates, availCameras, availAccessories }: {
  booking: any;
  rates: any[];
  availCameras: any[];
  availAccessories: any[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [returnItem, setReturnItem] = useState<{ id: string; type: "camera" | "accessory"; name: string } | null>(null);

  const [addType, setAddType] = useState<"camera" | "accessory">("camera");
  const [addItemId, setAddItemId] = useState("");
  const [addStart, setAddStart] = useState(todayStr());
  const [addEnd, setAddEnd] = useState(booking.end_at?.slice(0, 10) || "");
  const [addRate, setAddRate] = useState(0);
  const [returnDate, setReturnDate] = useState(todayStr());

  const bookingStart = booking.start_at?.slice(0, 10);
  const bookingEnd = booking.end_at?.slice(0, 10);

  function getDefaultRate(type: "camera" | "accessory", itemId: string) {
    const r = type === "camera"
      ? rates.find((r: any) => r.camera_id === itemId)
      : rates.find((r: any) => r.accessory_id === itemId);
    return Number(r?.daily_rate_inr || 0);
  }

  async function returnItemEarly() {
    if (!returnItem) return;
    setBusy(true); setErr("");
    try {
      const table = returnItem.type === "camera" ? "booking_cameras" : "booking_accessories";
      const { error } = await supabase.from(table).update({
        item_end_at: returnDate,
        returned_at: new Date().toISOString(),
      }).eq("id", returnItem.id);
      if (error) throw error;
      setReturnItem(null);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Failed to record return.");
    } finally {
      setBusy(false);
    }
  }

  async function addEquipment() {
    if (!addItemId) { setErr("Select an item."); return; }
    setBusy(true); setErr("");
    try {
      const table = addType === "camera" ? "booking_cameras" : "booking_accessories";
      const payload: any = {
        booking_id: booking.id,
        item_start_at: addStart,
        item_end_at: addEnd || null,
        daily_rate_inr: addRate,
      };
      if (addType === "camera") payload.camera_id = addItemId;
      else { payload.accessory_id = addItemId; payload.quantity = 1; }
      const { error } = await supabase.from(table).insert(payload);
      if (error) throw error;
      setAddOpen(false);
      setAddItemId(""); setAddRate(0);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Failed to add equipment.");
    } finally {
      setBusy(false);
    }
  }

  const allItems = [
    ...(booking.booking_cameras || []).map((x: any) => ({ ...x, type: "camera", asset: x.cameras })),
    ...(booking.booking_accessories || []).map((x: any) => ({ ...x, type: "accessory", asset: x.accessories })),
  ];

  const addDays = addStart && addEnd ? calcDays(addStart, addEnd) : 0;

  return (
    <div className="adminPanel" style={{ marginBottom: 14 }}>
      <div className="panelHeading" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Equipment</h2>
        <button type="button" className="button ghost" onClick={() => { setAddOpen(true); setErr(""); }}>
          + Add Equipment
        </button>
      </div>

      {allItems.length === 0 && <p className="formNote">No equipment assigned.</p>}

      {allItems.map((x: any) => {
        const start = x.item_start_at || bookingStart;
        const end = x.item_end_at || bookingEnd;
        const days = start && end ? calcDays(start, end) : 0;
        const lineTotal = (x.daily_rate_inr || 0) * days;
        const isReturned = !!x.returned_at;
        const code = x.asset?.camera_code || x.asset?.accessory_code;

        return (
          <div className="bookingRow" key={x.id} style={{ opacity: isReturned ? 0.55 : 1 }}>
            <div style={{ flex: 1 }}>
              <b>{code} · {x.asset?.name}</b>
              <span>
                {start} → {end}
                {" · "}
                {days}d
                {x.daily_rate_inr ? ` · ${money(x.daily_rate_inr)}/day` : " · no rate"}
                {" · "}
                <strong style={{ color: "var(--gold2)" }}>{money(lineTotal)}</strong>
                {isReturned && <> · <span style={{ color: "var(--green)" }}>✓ Returned</span></>}
                {x.item_start_at && <> · <span style={{ color: "var(--gold2)", fontSize: 11 }}>added mid-booking</span></>}
              </span>
            </div>
            {!isReturned && (
              <button
                type="button"
                className="button ghost small"
                onClick={() => { setReturnItem({ id: x.id, type: x.type, name: x.asset?.name }); setReturnDate(todayStr()); setErr(""); }}
              >
                Return Early
              </button>
            )}
          </div>
        );
      })}

      {err && <p className="studioError" style={{ marginTop: 10 }}>{err}</p>}

      {/* Add Equipment Modal */}
      {addOpen && (
        <div className="modalOverlay" onClick={() => setAddOpen(false)}>
          <div className="modalBox" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px" }}>Add Equipment to Booking</h3>
            <div className="formGrid">
              <label>Type
                <select value={addType} onChange={e => { setAddType(e.target.value as any); setAddItemId(""); setAddRate(0); }}>
                  <option value="camera">Camera</option>
                  <option value="accessory">Accessory</option>
                </select>
              </label>
              <label>Item
                <select value={addItemId} onChange={e => { setAddItemId(e.target.value); setAddRate(getDefaultRate(addType, e.target.value)); }}>
                  <option value="">— select —</option>
                  {(addType === "camera" ? availCameras : availAccessories).map((i: any) => (
                    <option key={i.id} value={i.id}>{i.camera_code || i.accessory_code} · {i.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="formGrid">
              <label>From
                <input type="date" value={addStart} onChange={e => setAddStart(e.target.value)} />
              </label>
              <label>To
                <input type="date" value={addEnd} min={addStart} onChange={e => setAddEnd(e.target.value)} />
              </label>
            </div>
            <label>Daily rate (₹)
              <input type="number" min="0" value={addRate} onChange={e => setAddRate(Number(e.target.value))} />
            </label>
            {addStart && addEnd && (
              <p className="formNote" style={{ marginTop: 6 }}>
                {addDays} day{addDays !== 1 ? "s" : ""}
                {addRate > 0 ? ` × ${money(addRate)} = ` : " · "}
                <strong>{addRate > 0 ? money(addRate * addDays) : "set a rate"}</strong>
              </p>
            )}
            {err && <p className="studioError">{err}</p>}
            <div className="panelActions" style={{ marginTop: 14 }}>
              <button type="button" className="button ghost" onClick={() => setAddOpen(false)}>Cancel</button>
              <button type="button" className="button gold" disabled={busy} onClick={addEquipment}>
                {busy ? "Adding…" : "Add to Booking"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Early Modal */}
      {returnItem && (
        <div className="modalOverlay" onClick={() => setReturnItem(null)}>
          <div className="modalBox" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px" }}>Return {returnItem.name} Early</h3>
            <label>Return date
              <input type="date" value={returnDate} max={bookingEnd} onChange={e => setReturnDate(e.target.value)} />
            </label>
            <p className="formNote" style={{ marginTop: 8 }}>
              Billing for this item stops on this date. The rest of the booking continues.
            </p>
            {err && <p className="studioError">{err}</p>}
            <div className="panelActions" style={{ marginTop: 14 }}>
              <button type="button" className="button ghost" onClick={() => setReturnItem(null)}>Cancel</button>
              <button type="button" className="button gold" disabled={busy} onClick={returnItemEarly}>
                {busy ? "Saving…" : "Confirm Return"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
