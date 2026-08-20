"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Camera = { id: string; camera_code: string; qr_code: string; name: string; manufacturer: string | null; model: string | null; serial_number: string | null; current_hours: number | null; location: string | null; status: string; rfid_tag: string | null };
type Accessory = { id: string; accessory_code: string; qr_code: string; name: string; category: string | null; serial_number: string | null; location: string | null; status: string; rfid_tag: string | null };

function CameraRow({ cam, onMutate }: { cam: Camera; onMutate: () => void }) {
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete ${cam.camera_code} — ${cam.name}? This cannot be undone.`)) return;
    setBusy(true);
    await supabase.from("cameras").delete().eq("id", cam.id);
    onMutate();
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    await supabase.from("cameras").update({
      name: String(f.get("name") || "").trim(),
      manufacturer: String(f.get("manufacturer") || "").trim() || null,
      model: String(f.get("model") || "").trim() || null,
      serial_number: String(f.get("serial") || "").trim() || null,
      current_hours: Number(f.get("hours") || 0),
      location: String(f.get("location") || "").trim() || null,
      status: String(f.get("status") || "available"),
    }).eq("id", cam.id);
    onMutate();
  }

  return (
    <div className="inventoryItem">
      <div className="inventoryRow">
        <div>
          <b>{cam.camera_code} · {cam.name}</b>
          <span>QR: {cam.qr_code} · {cam.manufacturer || ""}{cam.model ? ` ${cam.model}` : ""} · {cam.location || "—"}</span>
        </div>
        <div className="inventoryActions">
          <em className={`status ${cam.status}`}>{cam.status}</em>
          <button className="button ghost small" onClick={() => setEditing(v => !v)} disabled={busy}>
            {editing ? "Cancel" : "Edit"}
          </button>
          <button className="button danger small" onClick={handleDelete} disabled={busy}>Delete</button>
        </div>
      </div>
      {editing && (
        <form className="inventoryEditForm" onSubmit={handleEdit}>
          <div className="formGrid">
            <label>Name<input name="name" defaultValue={cam.name} required /></label>
            <label>Manufacturer<input name="manufacturer" defaultValue={cam.manufacturer || ""} /></label>
            <label>Model<input name="model" defaultValue={cam.model || ""} /></label>
            <label>Serial<input name="serial" defaultValue={cam.serial_number || ""} /></label>
            <label>Hours<input name="hours" type="number" min="0" step=".1" defaultValue={cam.current_hours ?? 0} /></label>
            <label>Location<input name="location" defaultValue={cam.location || "Chennai"} /></label>
            <label>Status
              <select name="status" defaultValue={cam.status}>
                <option value="available">available</option>
                <option value="reserved">reserved</option>
                <option value="out">out</option>
                <option value="maintenance">maintenance</option>
                <option value="retired">retired</option>
              </select>
            </label>
          </div>
          <button className="button gold" type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
        </form>
      )}
    </div>
  );
}

function AccessoryRow({ acc, onMutate }: { acc: Accessory; onMutate: () => void }) {
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete ${acc.accessory_code} — ${acc.name}? This cannot be undone.`)) return;
    setBusy(true);
    await supabase.from("accessories").delete().eq("id", acc.id);
    onMutate();
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    await supabase.from("accessories").update({
      name: String(f.get("name") || "").trim(),
      category: String(f.get("category") || "").trim() || null,
      serial_number: String(f.get("serial") || "").trim() || null,
      location: String(f.get("location") || "").trim() || null,
      status: String(f.get("status") || "available"),
    }).eq("id", acc.id);
    onMutate();
  }

  return (
    <div className="inventoryItem">
      <div className="inventoryRow">
        <div>
          <b>{acc.accessory_code} · {acc.name}</b>
          <span>QR: {acc.qr_code} · {acc.category || "—"} · {acc.location || "—"}</span>
        </div>
        <div className="inventoryActions">
          <em className={`status ${acc.status}`}>{acc.status}</em>
          <button className="button ghost small" onClick={() => setEditing(v => !v)} disabled={busy}>
            {editing ? "Cancel" : "Edit"}
          </button>
          <button className="button danger small" onClick={handleDelete} disabled={busy}>Delete</button>
        </div>
      </div>
      {editing && (
        <form className="inventoryEditForm" onSubmit={handleEdit}>
          <div className="formGrid">
            <label>Name<input name="name" defaultValue={acc.name} required /></label>
            <label>Category<input name="category" defaultValue={acc.category || ""} /></label>
            <label>Serial<input name="serial" defaultValue={acc.serial_number || ""} /></label>
            <label>Location<input name="location" defaultValue={acc.location || "Chennai"} /></label>
            <label>Status
              <select name="status" defaultValue={acc.status}>
                <option value="available">available</option>
                <option value="reserved">reserved</option>
                <option value="out">out</option>
                <option value="maintenance">maintenance</option>
                <option value="retired">retired</option>
              </select>
            </label>
          </div>
          <button className="button gold" type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
        </form>
      )}
    </div>
  );
}

export function InventoryManager({ cameras: initialCams, accessories: initialAccs }: { cameras: Camera[]; accessories: Accessory[] }) {
  const supabase = createClient();
  const [cameras, setCameras] = useState(initialCams);
  const [accessories, setAccessories] = useState(initialAccs);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<"camera" | "accessory" | null>(null);

  async function reload() {
    const [{ data: cams }, { data: accs }] = await Promise.all([
      supabase.from("cameras").select("*").order("camera_code"),
      supabase.from("accessories").select("*").order("accessory_code"),
    ]);
    setCameras(cams || []);
    setAccessories(accs || []);
  }

  async function addCamera(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const code = String(f.get("code") || "").trim().toUpperCase();
    setBusy("camera"); setMsg("");
    try {
      const { error } = await supabase.from("cameras").insert({
        camera_code: code, qr_code: `SCH-${code}`,
        name: String(f.get("name") || "").trim(),
        manufacturer: String(f.get("manufacturer") || "").trim() || null,
        model: String(f.get("model") || "").trim() || null,
        serial_number: String(f.get("serial") || "").trim() || null,
        current_hours: Number(f.get("hours") || 0),
        location: String(f.get("location") || "Chennai").trim() || "Chennai",
      });
      if (error) throw error;
      form.reset();
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Unable to add camera.");
    } finally { setBusy(null); }
  }

  async function addAccessory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const code = String(f.get("code") || "").trim().toUpperCase();
    setBusy("accessory"); setMsg("");
    try {
      const { error } = await supabase.from("accessories").insert({
        accessory_code: code, qr_code: `SCH-${code}`,
        name: String(f.get("name") || "").trim(),
        category: String(f.get("category") || "Accessory").trim() || "Accessory",
        serial_number: String(f.get("serial") || "").trim() || null,
        location: String(f.get("location") || "Chennai").trim() || "Chennai",
      });
      if (error) throw error;
      form.reset();
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Unable to add accessory.");
    } finally { setBusy(null); }
  }

  return (
    <>
      <div className="adminGrid">
        <form className="adminPanel formPanel" onSubmit={addCamera}>
          <h2>Add camera</h2>
          <label>Camera code<input name="code" required placeholder="CAM-001" /></label>
          <label>Camera name<input name="name" required placeholder="ARRI ALEXA 35" /></label>
          <div className="formGrid">
            <label>Manufacturer<input name="manufacturer" placeholder="ARRI" /></label>
            <label>Model<input name="model" placeholder="ALEXA 35" /></label>
          </div>
          <label>Serial number<input name="serial" /></label>
          <div className="formGrid">
            <label>Current hours<input name="hours" type="number" min="0" step=".1" defaultValue="0" /></label>
            <label>Location<input name="location" defaultValue="Chennai" /></label>
          </div>
          <button type="submit" className="button gold" disabled={!!busy}>{busy === "camera" ? "Adding…" : "Add camera + QR"}</button>
        </form>

        <form className="adminPanel formPanel" onSubmit={addAccessory}>
          <h2>Add accessory</h2>
          <label>Accessory code<input name="code" required placeholder="ACC-001" /></label>
          <label>Accessory name<input name="name" required placeholder="B-Mount Battery" /></label>
          <div className="formGrid">
            <label>Category<input name="category" placeholder="Battery" /></label>
            <label>Serial number<input name="serial" /></label>
          </div>
          <label>Location<input name="location" defaultValue="Chennai" /></label>
          <button type="submit" className="button gold" disabled={!!busy}>{busy === "accessory" ? "Adding…" : "Add accessory + QR"}</button>
        </form>
      </div>

      {msg && <div className="errorBox" role="status">{msg}</div>}

      <div className="adminPanel">
        <h2>Cameras ({cameras.length})</h2>
        {cameras.length === 0 && <p className="muted">No cameras yet.</p>}
        {cameras.map(cam => <CameraRow key={cam.id} cam={cam} onMutate={reload} />)}
      </div>

      <div className="adminPanel">
        <h2>Accessories ({accessories.length})</h2>
        {accessories.length === 0 && <p className="muted">No accessories yet.</p>}
        {accessories.map(acc => <AccessoryRow key={acc.id} acc={acc} onMutate={reload} />)}
      </div>
    </>
  );
}
