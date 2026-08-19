import { requireInvestor } from "@/lib/auth";
import Link from "next/link";
import { Suspense } from "react";
import { YearFilter } from "./YearFilter";
import { PayoutForm } from "./PayoutForm";

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const pct2 = (n: number) => `${Number(n || 0).toFixed(2)}%`;
const pct1 = (n: number) => `${Number(n || 0).toFixed(1)}%`;

function fmtDate(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtMonth(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function statusLabel(s: string) {
  const m: Record<string, string> = {
    reserved: "Reserved", confirmed: "Confirmed", preparing: "Preparing",
    checked_out: "Out Now", overdue: "Overdue", returned: "Returned", cancelled: "Cancelled",
  };
  return m[s] || s;
}

export default async function InvestPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { supabase, profile } = await requireInvestor();
  const { year = String(new Date().getFullYear()) } = await searchParams;
  const allTime = year === "all";
  const isAdmin = profile.role === "admin";

  // Investor data + deductions via SECURITY DEFINER RPCs
  const [{ data: investorRows }, { data: deductionRows }] = await Promise.all([
    supabase.rpc("get_arri_investor_data"),
    supabase.rpc("get_revenue_deductions"),
  ]);

  // Cameras from investor data
  const camMap = new Map<string, { id: string; camera_code: string; name: string }>();
  for (const r of (investorRows || [])) {
    if (!camMap.has(r.camera_id))
      camMap.set(r.camera_id, { id: r.camera_id, camera_code: r.camera_code, name: r.camera_name });
  }
  const arriCams = Array.from(camMap.values());
  const camIds = arriCams.map((c) => c.id);

  const totalCameraInr = (investorRows || []).reduce((n: number, r: any) => n + Number(r.invested_amount_inr || 0), 0);

  // Deduction summary
  const deductions = deductionRows || [];
  const totalDeductPct = deductions.reduce((n: number, d: any) => n + Number(d.percent || 0), 0);
  const investorPoolPct = 100 - totalDeductPct;

  // Bookings for ARRI cameras (filtered by year)
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
    if (allTime || new Date(b.start_at).getFullYear() === Number(year))
      if (!bookingMap.has(b.id)) bookingMap.set(b.id, b);
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

  // Waterfall on received revenue
  const deductionAmounts = deductions.map((d: any) => ({
    ...d,
    amount: totalReceived * Number(d.percent) / 100,
  }));
  const totalDeductedAmt = deductionAmounts.reduce((n: number, d: any) => n + d.amount, 0);
  const investorPoolAmt = totalReceived - totalDeductedAmt;

  // Payouts filtered by year
  const { data: allPayouts } = await supabase.rpc("get_arri_investor_payouts");
  const payouts = (allPayouts || []).filter((p: any) =>
    allTime || new Date(p.paid_at).getFullYear() === Number(year)
  );
  const totalPaidOut = payouts.reduce((n: number, p: any) => n + Number(p.amount_inr || 0), 0);

  // Monthly payout summary
  const monthMap = new Map<string, number>();
  for (const p of payouts) {
    const key = p.paid_at.slice(0, 7);
    monthMap.set(key, (monthMap.get(key) || 0) + Number(p.amount_inr || 0));
  }
  const monthSummary = Array.from(monthMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, total]) => ({ key, label: fmtMonth(key + "-01"), total }));

  // Per-investor breakdown
  const breakdown = (investorRows || []).map((row: any) => {
    const share = Number(row.ownership_percent || 0);         // % of investor pool
    const shareOfGross = share * investorPoolPct / 100;       // % of gross
    const revenueBilled = totalBilled * shareOfGross / 100;
    const revenueReceived = investorPoolAmt * share / 100;    // share of pool after deductions
    const investedInr = Number(row.invested_amount_inr || 0);
    const roiPct = investedInr > 0 ? (revenueReceived / investedInr) * 100 : 0;
    const paidOut = payouts
      .filter((p: any) => p.investor_id === row.investor_id)
      .reduce((n: number, p: any) => n + Number(p.amount_inr || 0), 0);
    return {
      inv: { id: row.investor_id, name: row.investor_name, location: row.location, ownership_percent: row.ownership_percent, invested_amount_inr: row.invested_amount_inr },
      share, shareOfGross, revenueBilled, revenueReceived, investedInr, roiPct, paidOut,
    };
  });

  const periodLabel = allTime ? "All time" : `Jan–Dec ${year}`;
  const investorOptions = (investorRows || []).map((r: any) => ({ id: r.investor_id, name: r.investor_name }));

  return (
    <div className="investPage">
      <div className="investPageHeader">
        <div>
          <p className="investEyebrow">ARRI INVESTMENT PORTFOLIO</p>
          <h1 className="investH1">Booking Performance</h1>
          <p className="investPeriodLabel">{periodLabel}</p>
        </div>
        <div className="investCamList">
          {arriCams.map((c) => (
            <span key={c.id} className="investCamChip">{c.camera_code} · {c.name}</span>
          ))}
        </div>
      </div>

      <Suspense><YearFilter currentYear={year} /></Suspense>

      {/* Revenue waterfall */}
      <section className="investCard investWaterfallCard">
        <h2 className="investCardTitle">Revenue Waterfall · {periodLabel}</h2>
        <div className="investWaterfall">
          <div className="investWaterfallRow gross">
            <span>Gross revenue received</span>
            <span className="investWaterfallPct">100%</span>
            <strong>{money(totalReceived)}</strong>
          </div>
          {deductionAmounts.map((d: any) => (
            <div key={d.code} className="investWaterfallRow deduct">
              <span>− {d.name}</span>
              <span className="investWaterfallPct">{pct1(d.percent)}</span>
              <span className="investWaterfallAmt">− {money(d.amount)}</span>
            </div>
          ))}
          <div className="investWaterfallRow pool">
            <span>Investor pool ({pct1(investorPoolPct)} of gross)</span>
            <span className="investWaterfallPct">{pct1(investorPoolPct)}</span>
            <strong className="investWaterfallPool">{money(investorPoolAmt)}</strong>
          </div>
        </div>
      </section>

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
          <small>gross payments</small>
        </div>
        <div className="investMetric gold">
          <span>Investor pool</span>
          <b>{money(investorPoolAmt)}</b>
          <small>after {pct1(totalDeductPct)} deductions</small>
        </div>
        {totalBalance > 0 && (
          <div className="investMetric warn">
            <span>Outstanding</span>
            <b>{money(totalBalance)}</b>
            <small>balance due</small>
          </div>
        )}
        <div className="investMetric">
          <span>Camera cost</span>
          <b>{money(totalCameraInr)}</b>
          <small>total investment</small>
        </div>
        {totalPaidOut > 0 && (
          <div className="investMetric warn">
            <span>Paid to investors</span>
            <b>{money(totalPaidOut)}</b>
            <small>{periodLabel}</small>
          </div>
        )}
      </div>

      {/* Investor breakdown */}
      {breakdown.length > 0 && (
        <section className="investCard">
          <h2 className="investCardTitle">Investor Revenue Share · {periodLabel}</h2>
          <p className="investBreakdownNote">Pool % = share of investor pool ({pct1(investorPoolPct)} of gross) · Gross % = effective share of total revenue</p>
          <div className="investBreakdownTable">
            <div className="investBreakdownHead investBreakdownHead8">
              <span>Investor</span>
              <span>Pool %</span>
              <span>Gross %</span>
              <span>Invested</span>
              <span>Billed share</span>
              <span>Received share</span>
              <span>Paid out</span>
              <span>ROI</span>
            </div>
            {breakdown.map(({ inv, share, shareOfGross, revenueBilled, revenueReceived, investedInr, roiPct, paidOut }: { inv: any; share: number; shareOfGross: number; revenueBilled: number; revenueReceived: number; investedInr: number; roiPct: number; paidOut: number }) => (
              <div key={inv.id} className="investBreakdownRow investBreakdownRow8">
                <div><b>{inv.name}</b>{inv.location && <small>{inv.location}</small>}</div>
                <span className="investSharePct">{pct2(share)}</span>
                <span className="investSharePct">{pct2(shareOfGross)}</span>
                <span>{money(investedInr)}</span>
                <span>{money(revenueBilled)}</span>
                <span className="investReceived">{money(revenueReceived)}</span>
                <span className="investPaidOut">{paidOut > 0 ? money(paidOut) : "—"}</span>
                <span className={`investRoi${roiPct >= 100 ? " full" : ""}`}>{pct1(roiPct)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Payouts */}
      <section className="investCard">
        <div className="investCardTitleRow">
          <h2 className="investCardTitle">Payouts to Investors · {periodLabel}</h2>
          {totalPaidOut > 0 && <span className="investCardTotal">{money(totalPaidOut)}</span>}
        </div>
        {payouts.length === 0 && <p className="investEmpty">No payouts recorded{allTime ? "" : " in this period"}.</p>}
        {monthSummary.map(({ key, label, total }) => {
          const monthPayouts = payouts.filter((p: any) => p.paid_at.startsWith(key));
          return (
            <div key={key} className="investPayoutMonth">
              <div className="investPayoutMonthHead">
                <span>{label}</span>
                <b>{money(total)}</b>
              </div>
              {monthPayouts.map((p: any) => (
                <div key={p.payout_id} className="investPayoutRow">
                  <span className="investPayoutName">{p.investor_name}</span>
                  <span className="investPayoutDate">{fmtDate(p.paid_at)}</span>
                  <span className="investPayoutMode">{p.payment_mode || "—"}</span>
                  {p.notes && <span className="investPayoutNotes">{p.notes}</span>}
                  <strong className="investPayoutAmt">{money(p.amount_inr)}</strong>
                </div>
              ))}
            </div>
          );
        })}
        {isAdmin && (
          <div className="investPayoutFormWrap">
            <h3 className="investPayoutFormTitle">Record a payout</h3>
            <PayoutForm investors={investorOptions} />
          </div>
        )}
      </section>

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
            <Link key={r.id} href={`/invest/receipts/${r.id}`} className="investRow investRowLink">
              <div className="investRowInfo">
                <b>{r.receipt_code} · {r.customers?.company_name || r.customers?.name}</b>
                <span>{r.bookings?.booking_code} · {r.bookings?.project_name} · {fmtDate(r.issued_at)}</span>
              </div>
              <div className="investRowRight">
                <strong>{money(r.amount_paid_inr)}</strong>
                {Number(r.balance_inr) > 0 && <span className="investBalanceDue">Balance {money(r.balance_inr)}</span>}
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
