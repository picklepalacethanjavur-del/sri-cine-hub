import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { BookingCorrectionPanel } from "./BookingCorrectionPanel";
import { BookingEquipment } from "./BookingEquipment";
import { BookingPayments } from "./BookingPayments";

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function calcDays(start: string, end: string) {
  return Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000));
}

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();

  const [
    { data: b },
    { data: payments },
    { data: audit },
    { data: receipt },
    { data: allCameras },
    { data: allAccessories },
    { data: rates },
  ] = await Promise.all([
    supabase.from("bookings")
      .select("*,customers(name,company_name,phone),booking_cameras(*,cameras(camera_code,name,qr_code,status)),booking_accessories(*,accessories(accessory_code,name,qr_code,status))")
      .eq("id", id).single(),
    supabase.from("payments").select("*").eq("booking_id", id).order("received_at", { ascending: false }),
    supabase.from("audit_log").select("id,action,created_at,old_data,new_data").eq("entity_id", id).order("created_at", { ascending: false }),
    supabase.from("receipts").select("id,receipt_code,balance_inr").eq("booking_id", id).maybeSingle(),
    supabase.from("cameras").select("id,camera_code,name,manufacturer").eq("status", "available"),
    supabase.from("accessories").select("id,accessory_code,name,category").eq("status", "available"),
    supabase.from("internal_rates").select("camera_id,accessory_id,daily_rate_inr"),
  ]);

  if (!b) notFound();

  const bookedCamIds = new Set((b.booking_cameras || []).map((x: any) => x.camera_id));
  const bookedAccIds = new Set((b.booking_accessories || []).map((x: any) => x.accessory_id));
  const availCameras = (allCameras || []).filter((c: any) => !bookedCamIds.has(c.id));
  const availAccessories = (allAccessories || []).filter((a: any) => !bookedAccIds.has(a.id));

  const totalCharges = [
    ...(b.booking_cameras || []).map((x: any) => {
      const start = x.item_start_at || b.start_at;
      const end = x.item_end_at || b.end_at;
      return (x.daily_rate_inr || 0) * calcDays(start, end);
    }),
    ...(b.booking_accessories || []).map((x: any) => {
      const start = x.item_start_at || b.start_at;
      const end = x.item_end_at || b.end_at;
      return (x.daily_rate_inr || 0) * calcDays(start, end);
    }),
  ].reduce((s, n) => s + n, 0);

  const totalPaid = (payments || []).reduce((s: number, p: any) => s + Number(p.amount_inr || 0), 0);
  const outstanding = totalCharges - totalPaid;

  return (
    <section className="adminShell">
      <div className="eyebrow">BOOKING {b.booking_code}</div>
      <div className="adminTitle">
        <div>
          <h1>{b.production_name || b.customers?.company_name || b.customers?.name || "Booking"}</h1>
          <p className="muted">{b.project_name || b.customers?.name || "—"}</p>
        </div>
        <em className={`status ${b.status}`}>{String(b.status).replaceAll("_", " ")}</em>
      </div>

      <div className="bookingDetailActions">
        <Link className="button ghost" href="/studio/bookings">← All Bookings</Link>
        {["reserved","confirmed","preparing"].includes(b.status) && (
          <Link className="button gold" href={`/studio/ops?booking=${b.id}`}>Go to Checkout</Link>
        )}
        {["checked_out","overdue"].includes(b.status) && (
          <Link className="button gold" href={`/studio/ops?booking=${b.id}`}>Go to Return</Link>
        )}
        {receipt && (
          <Link className="button ghost" href={`/admin/receipts/${receipt.id}/print`}>Open Receipt</Link>
        )}
      </div>

      <div className="metricGrid">
        <div className="metric"><span>Status</span><b style={{ fontSize: 18 }}>{String(b.status).replaceAll("_", " ")}</b></div>
        <div className="metric"><span>Total Charges</span><b>{money(totalCharges)}</b></div>
        <div className="metric"><span>Paid</span><b style={{ color: "var(--green)" }}>{money(totalPaid)}</b></div>
        <div className="metric">
          <span>Outstanding</span>
          <b style={{ color: outstanding > 0 ? "#f59e0b" : "var(--green)" }}>{money(outstanding)}</b>
        </div>
      </div>

      <BookingEquipment
        booking={b}
        rates={rates || []}
        availCameras={availCameras}
        availAccessories={availAccessories}
      />

      <BookingPayments
        bookingId={b.id}
        payments={payments || []}
        totalCharges={totalCharges}
      />

      <BookingCorrectionPanel booking={b} />

      <div className="adminPanel">
        <h2>Activity history</h2>
        <div className="activityTimeline">
          {(audit || []).length === 0 && <p className="formNote">No activity recorded.</p>}
          {(audit || []).map((a: any) => (
            <div className="activityRow" key={a.id}>
              <div>
                <b>{String(a.action).replaceAll("_", " ")}</b>
                <span>{new Date(a.created_at).toLocaleString("en-IN")}</span>
                {a.new_data?.reason && <small>Reason: {a.new_data.reason}</small>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
