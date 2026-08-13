"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type QuoteRequest = {
  id: string;
  request_code: string;
  name: string;
  company_name: string | null;
  phone: string;
  project_name: string | null;
  start_at: string;
  end_at: string;
  requested_camera_ids: string[] | null;
  status: string;
};

type InternalRate = {
  camera_id: string | null;
  daily_rate_inr: number | string | null;
};

type Camera = { id: string; camera_code: string; name: string };

type Quotation = {
  id: string;
  quotation_code: string;
  status: string;
  valid_until: string | null;
  total_inr: number | string | null;
  customers?: { name: string | null; company_name: string | null } | null;
};

type QuoteItem = { id: string; description: string; rate: number };

type Props = {
  requests: QuoteRequest[];
  rates: InternalRate[];
  cameras: Camera[];
  quotations: Quotation[];
  userId: string;
};

export function QuoteManager({ requests, rates, cameras, quotations, userId }: Props) {
  const supabase = createClient();
  const [requestId, setRequestId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [message, setMessage] = useState("");
  const req = requests.find((r) => r.id === requestId);

  const days = req
    ? Math.max(1, Math.ceil((new Date(req.end_at).getTime() - new Date(req.start_at).getTime()) / 86400000))
    : 1;

  const items = useMemo<QuoteItem[]>(() => {
    if (!req) return [];
    return (req.requested_camera_ids ?? []).map((id: string): QuoteItem => {
      const camera = cameras.find((x) => x.id === id);
      const rate = rates.find((x) => x.camera_id === id);
      return {
        id,
        description: `${camera?.camera_code ?? ""} ${camera?.name ?? "Camera"}`.trim(),
        rate: Number(rate?.daily_rate_inr ?? 0),
      };
    });
  }, [req, rates, cameras]);

  const subtotal = items.reduce((sum: number, item: QuoteItem) => sum + item.rate * days, 0);

  async function generate() {
    if (!req) return;
    setMessage("");

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert({ name: req.name, company_name: req.company_name, phone: req.phone })
      .select("id")
      .single();
    if (customerError) return setMessage(customerError.message);

    const { data: quotation, error: quoteError } = await supabase
      .from("quotations")
      .insert({
        quote_request_id: req.id,
        customer_id: customer.id,
        subtotal_inr: subtotal,
        discount_inr: discount,
        created_by: userId,
        valid_until: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      })
      .select("id,quotation_code")
      .single();
    if (quoteError) return setMessage(quoteError.message);
    if (!quotation) return setMessage("Quotation could not be created.");

    if (items.length) {
      const { error: itemError } = await supabase.from("quotation_items").insert(
        items.map((item: QuoteItem, index: number) => ({
          quotation_id: quotation.id,
          item_type: "camera",
          item_id: item.id,
          description: item.description,
          quantity: 1,
          rental_days: days,
          unit_rate_inr: item.rate,
          sort_order: index,
        }))
      );
      if (itemError) return setMessage(itemError.message);
    }

    const { error: requestError } = await supabase
      .from("quote_requests")
      .update({ status: "quoted" })
      .eq("id", req.id);
    if (requestError) return setMessage(requestError.message);

    setMessage(`Quotation ${quotation.quotation_code} generated.`);
    window.setTimeout(() => window.location.reload(), 700);
  }

  return (
    <>
      <div className="adminGrid">
        <div className="adminPanel formPanel">
          <h2>Generate quotation</h2>
          <select value={requestId} onChange={(e) => setRequestId(e.target.value)}>
            <option value="">Choose quote request</option>
            {requests.filter((r) => r.status === "new").map((r) => (
              <option key={r.id} value={r.id}>
                {r.request_code} · {r.company_name || r.name} · {r.project_name || "Project"}
              </option>
            ))}
          </select>
          {req && (
            <>
              <p>{new Date(req.start_at).toLocaleString("en-IN")} → {new Date(req.end_at).toLocaleString("en-IN")} · {days} rental day(s)</p>
              {items.map((item: QuoteItem) => (
                <div className="bookingRow" key={item.id}>
                  <span>{item.description}</span>
                  <b>₹{item.rate.toLocaleString("en-IN")}/day</b>
                </div>
              ))}
              <label>Discount ₹<input type="number" min="0" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></label>
              <div className="quoteTotal"><span>Total</span><b>₹{Math.max(0, subtotal - discount).toLocaleString("en-IN")}</b></div>
              <button className="button gold" type="button" onClick={generate}>Generate quotation</button>
            </>
          )}
          {message && <div className={message.startsWith("Quotation") ? "successBox" : "errorBox"}>{message}</div>}
        </div>
        <div className="adminPanel"><h2>Why prices stay private</h2><p>Customer quote requests contain equipment and dates only. Rate cards are readable only by staff/admin.</p></div>
      </div>
      <div className="adminPanel"><h2>Quotation history</h2>{quotations.map((q) => <div className="bookingRow" key={q.id}><div><b>{q.quotation_code} · {q.customers?.company_name || q.customers?.name || "Customer"}</b><span>{q.status} · valid to {q.valid_until || "—"}</span></div><strong>₹{Number(q.total_inr || 0).toLocaleString("en-IN")}</strong></div>)}</div>
    </>
  );
}
