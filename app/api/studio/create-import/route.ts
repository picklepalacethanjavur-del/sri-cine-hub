import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { company_name, phone, start_at, end_at, items } = body as {
    company_name: string;
    phone?: string;
    start_at?: string | null;
    end_at?: string | null;
    items: { description: string; item_type: string; item_id: string; quantity: number; rental_days: number; rate: number; rawLine: string }[];
  };

  // 1. Create quote_request
  const { data: qr, error: qrErr } = await supabase
    .from("quote_requests")
    .insert({ company_name, contact_phone: phone || null, start_at: start_at || null, end_at: end_at || null, status: "pending" })
    .select("id")
    .single();
  if (qrErr) return NextResponse.json({ error: qrErr.message }, { status: 500 });

  // 2. Create quotation (draft). Generate code; DB trigger may overwrite it.
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  const quotationCode = `QT-${dateStr}-${suffix}`;

  const { data: qt, error: qtErr } = await supabase
    .from("quotations")
    .insert({ quotation_code: quotationCode, quote_request_id: qr.id, status: "draft" })
    .select("id")
    .single();
  if (qtErr) return NextResponse.json({ error: qtErr.message }, { status: 500 });

  // 3. Save items via existing RPC
  const rpcItems = items.map((item, i) => ({
    key: `import-${i}`,
    item_type: item.item_type === "camera" ? "camera" : item.item_type === "accessory" ? "accessory" : "manual",
    item_id: item.item_id || "",
    request_item_id: "",
    catalog_item_id: "",
    supplier_id: "",
    supplier_catalog_item_id: "",
    section_name: "General",
    requested_description: item.rawLine || item.description,
    description: item.description,
    source_type: item.item_id ? "internal" : "manual",
    quantity: item.quantity,
    rental_days: item.rental_days,
    internal_rate_inr: item.rate,
    cost_rate_inr: 0,
    cost_rate_basis: "daily",
    quoted_rate_inr: item.rate,
    supplier_name: "",
    supplier_status: "not_required",
    supplier_reference: "",
    notes: item.rawLine ? `Imported: ${item.rawLine}` : "",
    sort_order: i,
  }));

  const { error: saveErr } = await supabase.rpc("save_quotation_atomic", {
    p_quotation_id: qt.id,
    p_status: "draft",
    p_discount_inr: 0,
    p_tax_inr: 0,
    p_other_charges_inr: 0,
    p_customer_notes: null,
    p_internal_notes: `Imported from WhatsApp message`,
    p_items: rpcItems,
  });
  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 });

  return NextResponse.json({ quotationId: qt.id });
}
