import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { QuoteBuilder } from "./QuoteBuilder";

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireStaff();

  const [
    { data: req },
    { data: cameras },
    { data: accessories },
    { data: supplierItems },
    { data: existingQuotes },
    { data: internalRates },
  ] = await Promise.all([
    supabase.from("quote_requests").select("*").eq("id", id).single(),
    supabase.from("cameras").select("id,camera_code,name,status").neq("status", "retired").order("camera_code"),
    supabase.from("accessories").select("id,accessory_code,name,category,status").neq("status", "retired").order("accessory_code"),
    supabase.from("supplier_catalog_items")
      .select("id,supplier_id,supplier_item_name,category,quantity_available,default_cost_inr,rate_basis,suppliers(company_name)")
      .eq("is_active", true)
      .order("category"),
    supabase.from("quotations").select("id,quotation_code,status,total_inr").eq("quote_request_id", id).order("created_at", { ascending: false }),
    supabase.from("internal_rates").select("camera_id,accessory_id,daily_rate_inr").order("effective_from", { ascending: false }),
  ]);

  if (!req) notFound();

  // One draft per request: redirect directly to the existing draft
  const draft = (existingQuotes || []).find((q: any) => q.status === "draft");
  if (draft) redirect(`/admin/quotations/${draft.id}`);

  let bookedCameraIds: string[] = [];
  let bookedAccessoryIds: string[] = [];

  if (req.start_at && req.end_at) {
    const [{ data: bookedCams }, { data: bookedAccs }] = await Promise.all([
      supabase
        .from("booking_cameras")
        .select("camera_id, bookings!inner(start_at, end_at, status)")
        .not("bookings.status", "in", '("cancelled","returned")')
        .lt("bookings.start_at", req.end_at)
        .gt("bookings.end_at", req.start_at),
      supabase
        .from("booking_accessories")
        .select("accessory_id, bookings!inner(start_at, end_at, status)")
        .not("bookings.status", "in", '("cancelled","returned")')
        .lt("bookings.start_at", req.end_at)
        .gt("bookings.end_at", req.start_at),
    ]);
    bookedCameraIds = (bookedCams || []).map((x: any) => x.camera_id);
    bookedAccessoryIds = (bookedAccs || []).map((x: any) => x.accessory_id);
  }

  const rentalDays = req.start_at && req.end_at
    ? Math.max(1, Math.ceil((new Date(req.end_at).getTime() - new Date(req.start_at).getTime()) / 86400000))
    : 1;

  return (
    <QuoteBuilder
      request={req}
      cameras={cameras || []}
      accessories={accessories || []}
      supplierItems={supplierItems || []}
      existingQuotes={existingQuotes || []}
      bookedCameraIds={bookedCameraIds}
      bookedAccessoryIds={bookedAccessoryIds}
      rentalDays={rentalDays}
      internalRates={internalRates || []}
      userId={user.id}
    />
  );
}
