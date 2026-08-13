"use client";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DateTimePicker } from "@/components/DateTimePicker";

type Camera = {
  camera_id: string;
  camera_code: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  image_url: string | null;
  available: boolean;
};

function localMin() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function QuoteForm() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [datesChecked, setDatesChecked] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const minDate = useMemo(() => localMin(), []);
  const supabase = createClient();

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
      setCameras([]);
      setSelected([]);
      setDatesChecked(false);
      return;
    }

    if (!validPeriod(s, e)) {
      setCameras([]);
      setSelected([]);
      setDatesChecked(false);
      setMessage("Choose a future start time and a return time after the start.");
      return;
    }

    setCheckingAvailability(true);
    setMessage("");
    setDatesChecked(true);

    try {
      const { data, error } = await supabase.rpc("public_camera_availability", {
        p_start: new Date(s).toISOString(),
        p_end: new Date(e).toISOString(),
      });

      if (error) {
        setCameras([]);
        setSelected([]);
        setMessage(error.message);
        return;
      }

      setCameras((data || []) as Camera[]);
      setSelected([]);
    } catch (err) {
      setCameras([]);
      setSelected([]);
      setMessage(err instanceof Error ? err.message : "Unable to check camera availability.");
    } finally {
      setCheckingAvailability(false);
    }
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

      const { data, error } = await supabase.rpc("submit_quote_request", {
        p_name: String(f.get("name") || ""),
        p_company_name: String(f.get("client") || ""),
        p_phone: String(f.get("phone") || ""),
        p_project_name: String(f.get("project") || ""),
        p_start: new Date(start).toISOString(),
        p_end: new Date(end).toISOString(),
        p_requested_camera_ids: selected,
        p_notes: String(f.get("notes") || ""),
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage(`Request ${data} received. Sri Cine Hub will confirm availability and pricing.`);
      setSuccess(true);

      form.reset();
      setSelected([]);
      setCameras([]);
      setStart("");
      setEnd("");
      setDatesChecked(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to submit your request.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="quoteForm" onSubmit={submit}>
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

      <div className="availabilityBox">
        <b>Camera availability</b>

        {checkingAvailability && <p className="formNote">Checking availability…</p>}

        {!checkingAvailability && !datesChecked && (
          <p className="formNote">
            Choose start and return dates. The calendar opens when you tap the date field.
          </p>
        )}

        {!checkingAvailability && datesChecked && cameras.length === 0 && (
          <p className="formNote">
            No cameras are currently configured or available for the selected dates.
          </p>
        )}

        {!checkingAvailability &&
          cameras.map((c) => (
            <label
              key={c.camera_id}
              className={`availabilityRow ${c.available ? "available" : "unavailable"}`}
            >
              <input
                type="checkbox"
                disabled={!c.available}
                checked={selected.includes(c.camera_id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, c.camera_id]
                      : selected.filter((x) => x !== c.camera_id),
                  )
                }
              />
              <span>
                <strong>
                  {c.camera_code} · {c.name}
                </strong>
                <small>{c.available ? "Available" : "Unavailable"}</small>
              </span>
            </label>
          ))}
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
        Package requirements
        <textarea
          name="notes"
          rows={5}
          maxLength={2000}
          placeholder="Lenses, lights, grip, crew, transport, genset, post-production…"
        />
      </label>

      <button className="button gold" disabled={loading} type="submit">
        {loading ? "Submitting…" : "Request availability & quote"}
      </button>

      {message && (
        <div className={success ? "successBox" : "errorBox"} role="status" aria-live="polite">
          {message}
        </div>
      )}

      <p className="formNote">Rates are internal. No payment is collected here.</p>
    </form>
  );
}
