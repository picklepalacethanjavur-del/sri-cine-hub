import { requireInvestor } from "@/lib/auth";
import Link from "next/link";
import { Suspense } from "react";
import { YearFilter } from "./YearFilter";

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const pct = (n: number) => `${Number(n || 0).toFixed(1)}%`;

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

export default async function InvestPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { supabase } = await requireInvestor();
  const { year = String(new Date().getFullYear()) } = await searchParams;
  const allTime = year === "all";

  // ARRI cameras
  const { data: arriCams } = await supabase
    .from("cameras")
    .select("id,camera_code,name,manufacturer,model")
    .or("manufacturer.ilike.%arri%,name.ilike.%arri%");

  const camIds = (arriCams || []).map((c: any) => c.id);

  // Investor breakdown for these cameras
  const { data: investmentRows } = camIds.length > 0
    ? await supabase
        .from("camera_investments")
        .select("investment_pct,actual_paid_usd,actual_paid_inr,investors(id,investor_code,name,location)")
        .in("camera_id", camIds)
        .order("investment_pct", { ascending: false })
    : { data: [] };

  const totalCameraInr = (investmentRows || []).reduce((n: number, r: any) => n + Number(r.actual_paid_inr || 0), 0);

  // Bookings
  const { data: bookingCamRows } = camIds.length > 0
    ? await supabase
        .from("booking_cameras")
        .select("camera_id, bookings(id,booking_code,status,production_name,project_name,start_at,end_at,quoted_total_inr,customers(name,company_name))")
        .in("camera_id", camIds)
    : { data: [] };

  const bookingMap = new Map<string, any>();
  for (const row of (bookingCamRows || [])) {
    const b = (row as any).bookings;
    if (!b) continue;
    if (allTime || new Date(b.start_at).getFullYear() === Number(year)) {
      if (!bookingMap.has(b.id)) bookingMap.set(b.id, b);
    }
  }
  const bookings = Array.from(bookingMap.values()).sort((a: any, b: any) =>
    new Date(b.start_at).getTime() - new Date(a.start_at).getTime()
  );

  // Receipts
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

  // Per-investor breakdown
  const breakdown = (investmentRows || []).map((row: any) => {
    const inv = row.investors;
    const share = Number(row.investment_pct || 0);
    const revenueBilled = totalBilled * share / 100;
    const revenueReceived = totalReceived * share / 100;
    const investedInr = Number(row.actual_paid_inr || 0);
    const roiPct = investedInr > 0 ? (revenueReceived / investedInr) * 100 : 0;
    return { inv, share, revenueBilled, revenueReceived, investedInr, roiPct };
  });

  const periodLabel = allTime ? "All time" : `Jan–Dec ${year}`;

  return (
    <div className="investPage">
      <div className="investPageHeader">
        <div>
          <p className="investEyebrow">ARRI INVESTMENT PORTFOLIO</p>
          <h1 className="investH1">Booking Performance</h1>
          <p className="investPeriodLabel">{periodLabel}</p>
        </div>
        <div className="investCamList">
          {(arriCams || []).map((c: any) => (
            <span key={c.id} className="investCamChip">{c.camera_code} · {c.name}</span>
          ))}
        </div>
      </div>

      <Suspense><YearFilter currentYear={year} /></Suspense>

      {/* Top metrics */}
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
          <small>{periodLabel}</small>
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
        {totalCameraInr > 0 && (
          <div className="investMetric">
            <span>Camera cost</span>
            <b>{money(totalCameraInr)}</b>
            <small>total investment</small>
          </div>
        )}
      </div>

      {/* Investor breakdown */}
      {breakdown.length > 0 && (
        <section className="investCard">
          <h2 className="investCardTitle">Investor Revenue Share · {periodLabel}</h2>
          <div className="investBreakdownTable">
            <div className="investBreakdownHead">
              <span>Investor</span>
              <span>Share %</span>
              <span>Invested</span>
              <span>Revenue share (billed)</span>
              <span>Revenue share (received)</span>
              <span>ROI recovered</span>
            </div>
            {breakdown.map(({ inv, share, revenueBilled, revenueReceived, investedInr, roiPct }) => (
              <div key={inv?.id || share} className="investBreakdownRow">
                <div>
                  <b>{inv?.name || "—"}</b>
                  {inv?.location && <small>{inv.location}</small>}
                </div>
                <span className="investSharePct">{pct(share)}</span>
                <span>{money(investedInr)}</span>
                <span>{money(revenueBilled)}</span>
                <span className="investReceived">{money(revenueReceived)}</span>
                <span className={`investRoi${roiPct >= 100 ? " full" : ""}`}>{pct(roiPct)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bookings */}
      <section className="investCard">
        <h2 className="investCardTitle">All ARRI Bookings · {periodLabel}</h2>
        {bookings.length === 0 && <p className="investEmpty">No bookings in this period.</p>}
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

      {/* Receipts */}
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
