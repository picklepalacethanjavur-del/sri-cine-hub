import { requireInvestor } from "@/lib/auth";
import Link from "next/link";

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
function fmtDate(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function statusLabel(s: string) {
  const m: Record<string, string> = {
    reserved: "Reserved", confirmed: "Confirmed", preparing: "Preparing",
    checked_out: "Out Now", overdue: "Overdue", returned: "Returned", cancelled: "Cancelled",
  };
  return m[s] || s;
}

export default async function InvestPage() {
  const { supabase } = await requireInvestor();

  const { data: arriCams } = await supabase
    .from("cameras")
    .select("id,camera_code,name,manufacturer,model")
    .or("manufacturer.ilike.%arri%,name.ilike.%arri%");

  const camIds = (arriCams || []).map((c: any) => c.id);

  const { data: bookingCamRows } = camIds.length > 0
    ? await supabase
        .from("booking_cameras")
        .select("camera_id, bookings(id,booking_code,status,production_name,project_name,start_at,end_at,quoted_total_inr,customers(name,company_name))")
        .in("camera_id", camIds)
    : { data: [] };

  const bookingMap = new Map<string, any>();
  for (const row of (bookingCamRows || [])) {
    const b = (row as any).bookings;
    if (b && !bookingMap.has(b.id)) bookingMap.set(b.id, b);
  }
  const bookings = Array.from(bookingMap.values()).sort((a: any, b: any) =>
    new Date(b.start_at).getTime() - new Date(a.start_at).getTime()
  );

  const bookingIds = bookings.map((b: any) => b.id);
  const { data: receipts } = bookingIds.length > 0
    ? await supabase
        .from("receipts")
        .select("id,receipt_code,amount_paid_inr,balance_inr,issued_at,booking_id,bookings(booking_code,project_name),customers(name,company_name)")
        .in("booking_id", bookingIds)
        .order("issued_at", { ascending: false })
    : { data: [] };

  const totalBilled = bookings.reduce((n: number, b: any) => n + Number(b.quoted_total_inr || 0), 0);
  const totalReceived = (receipts || []).reduce((n: number, r: any) => n + Number(r.amount_paid_inr || 0), 0);
  const totalBalance = (receipts || []).reduce((n: number, r: any) => n + Number(r.balance_inr || 0), 0);
  const activeCount = bookings.filter((b: any) =>
    ["checked_out", "overdue", "reserved", "confirmed", "preparing"].includes(b.status)
  ).length;

  return (
    <div className="investPage">
      <div className="investPageHeader">
        <div>
          <p className="investEyebrow">ARRI INVESTMENT PORTFOLIO</p>
          <h1 className="investH1">Booking Performance</h1>
        </div>
        <div className="investCamList">
          {(arriCams || []).map((c: any) => (
            <span key={c.id} className="investCamChip">{c.camera_code} · {c.name}</span>
          ))}
        </div>
      </div>

      <div className="investMetrics">
        <div className="investMetric">
          <span>Total booked</span>
          <b>{bookings.length}</b>
          <small>bookings</small>
        </div>
        <div className="investMetric">
          <span>Active now</span>
          <b>{activeCount}</b>
          <small>in progress</small>
        </div>
        <div className="investMetric gold">
          <span>Total billed</span>
          <b>{money(totalBilled)}</b>
          <small>across all bookings</small>
        </div>
        <div className="investMetric gold">
          <span>Received</span>
          <b>{money(totalReceived)}</b>
          <small>payments collected</small>
        </div>
        {totalBalance > 0 && (
          <div className="investMetric warn">
            <span>Outstanding</span>
            <b>{money(totalBalance)}</b>
            <small>balance due</small>
          </div>
        )}
      </div>

      <section className="investCard">
        <h2 className="investCardTitle">All ARRI Bookings</h2>
        {bookings.length === 0 && <p className="investEmpty">No bookings recorded yet.</p>}
        {bookings.map((b: any) => (
          <div key={b.id} className="investRow">
            <div className="investRowInfo">
              <b>{b.booking_code} · {b.customers?.company_name || b.customers?.name || b.production_name}</b>
              <span>{b.project_name || "—"} · {fmtDate(b.start_at)} → {fmtDate(b.end_at)}</span>
            </div>
            <div className="investRowRight">
              {b.quoted_total_inr ? <strong>{money(b.quoted_total_inr)}</strong> : null}
              <span className={`investBadge ${b.status}`}>{statusLabel(b.status)}</span>
            </div>
          </div>
        ))}
      </section>

      {(receipts || []).length > 0 && (
        <section className="investCard">
          <h2 className="investCardTitle">Revenue · Receipts</h2>
          {(receipts || []).map((r: any) => (
            <Link key={r.id} href={`/admin/receipts/${r.id}/print`} className="investRow investRowLink">
              <div className="investRowInfo">
                <b>{r.receipt_code} · {r.customers?.company_name || r.customers?.name}</b>
                <span>{r.bookings?.booking_code} · {r.bookings?.project_name} · {fmtDate(r.issued_at)}</span>
              </div>
              <div className="investRowRight">
                <strong>{money(r.amount_paid_inr)}</strong>
                {Number(r.balance_inr) > 0 && (
                  <span className="investBalanceDue">Balance {money(r.balance_inr)}</span>
                )}
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
