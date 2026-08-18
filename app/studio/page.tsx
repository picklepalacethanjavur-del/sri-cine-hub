import Link from "next/link";
import { requireStaff } from "@/lib/auth";

function fmt(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function StudioToday() {
  const { supabase } = await requireStaff();
  await supabase.rpc("sync_overdue_bookings");

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);

  const [{ data: cameras }, { data: allBookings }, { data: newRequests }, { data: pricingRequests }] = await Promise.all([
    supabase.from("cameras").select("id,status"),
    supabase.from("bookings")
      .select("id,booking_code,production_name,project_name,start_at,end_at,status,customers(name,company_name)")
      .in("status", ["reserved", "confirmed", "preparing", "checked_out", "overdue"])
      .order("start_at", { ascending: true }),
    supabase.from("quote_requests").select("id,request_code,company_name,name,project_name,created_at").eq("status", "new").order("created_at", { ascending: true }),
    supabase.from("quote_requests").select("id,request_code,company_name,name,project_name,created_at").eq("status", "reviewing").order("created_at", { ascending: true }),
  ]);

  const cams = cameras || [];
  const books = allBookings || [];

  const overdueCheckouts = books.filter((b: any) => ["reserved","confirmed","preparing"].includes(b.status) && b.start_at < todayStr);
  const checkoutsToday   = books.filter((b: any) => ["reserved","confirmed","preparing"].includes(b.status) && b.start_at >= todayStr && b.start_at < tomorrowStr);
  const overdueReturns   = books.filter((b: any) => b.status === "overdue");
  const returnsToday     = books.filter((b: any) => b.status === "checked_out" && b.end_at >= todayStr && b.end_at < tomorrowStr);

  const allClear = !overdueCheckouts.length && !checkoutsToday.length && !overdueReturns.length && !returnsToday.length && !(newRequests?.length) && !(pricingRequests?.length);

  return (
    <div className="studioPage">
      <div className="studioPageHeader">
        <p className="studioEyebrow">STUDIO</p>
        <h1 className="studioH1">Today</h1>
      </div>

      <div className="studioMetrics">
        <div className="studioMetric"><span>Available cameras</span><b>{cams.filter((c: any) => c.status === "available").length}</b></div>
        <div className="studioMetric warn"><span>Out now</span><b>{cams.filter((c: any) => c.status === "out").length}</b></div>
        <div className={`studioMetric${overdueReturns.length ? " danger" : ""}`}><span>Overdue returns</span><b>{overdueReturns.length}</b></div>
        <div className="studioMetric"><span>Needs pricing</span><b>{(newRequests?.length || 0) + (pricingRequests?.length || 0)}</b></div>
      </div>

      {(overdueCheckouts.length > 0 || checkoutsToday.length > 0) && (
        <section className="studioCard">
          <h2 className="studioCardTitle">
            Checkouts
            {overdueCheckouts.length > 0 && <span className="studioAlert">{overdueCheckouts.length} overdue</span>}
          </h2>
          {overdueCheckouts.map((b: any) => (
            <Link href={`/studio/ops?booking=${b.id}`} key={b.id} className="studioRow urgent">
              <div className="studioRowInfo">
                <b>{b.booking_code} · {b.customers?.company_name || b.customers?.name || b.production_name}</b>
                <span>{b.project_name} · started {fmt(b.start_at)}</span>
              </div>
              <span className="studioRowAction">Checkout →</span>
            </Link>
          ))}
          {checkoutsToday.map((b: any) => (
            <Link href={`/studio/ops?booking=${b.id}`} key={b.id} className="studioRow">
              <div className="studioRowInfo">
                <b>{b.booking_code} · {b.customers?.company_name || b.customers?.name || b.production_name}</b>
                <span>{b.project_name} · {fmt(b.start_at)}</span>
              </div>
              <span className="studioRowAction">Checkout →</span>
            </Link>
          ))}
        </section>
      )}

      {(overdueReturns.length > 0 || returnsToday.length > 0) && (
        <section className="studioCard">
          <h2 className="studioCardTitle">
            Returns
            {overdueReturns.length > 0 && <span className="studioAlert danger">{overdueReturns.length} overdue</span>}
          </h2>
          {overdueReturns.map((b: any) => (
            <Link href={`/studio/ops?booking=${b.id}`} key={b.id} className="studioRow urgent">
              <div className="studioRowInfo">
                <b>{b.booking_code} · {b.customers?.company_name || b.customers?.name || b.production_name}</b>
                <span>{b.project_name} · was due {fmt(b.end_at)}</span>
              </div>
              <span className="studioRowAction">Return →</span>
            </Link>
          ))}
          {returnsToday.map((b: any) => (
            <Link href={`/studio/ops?booking=${b.id}`} key={b.id} className="studioRow">
              <div className="studioRowInfo">
                <b>{b.booking_code} · {b.customers?.company_name || b.customers?.name || b.production_name}</b>
                <span>{b.project_name} · due {fmt(b.end_at)}</span>
              </div>
              <span className="studioRowAction">Return →</span>
            </Link>
          ))}
        </section>
      )}

      {((newRequests?.length || 0) + (pricingRequests?.length || 0)) > 0 && (
        <section className="studioCard">
          <h2 className="studioCardTitle">Quotes needing attention</h2>
          {(newRequests || []).map((r: any) => (
            <Link href={`/studio/requests/${r.id}`} key={r.id} className="studioRow">
              <div className="studioRowInfo">
                <b>{r.request_code} · {r.company_name || r.name || "Untitled"}</b>
                <span>{r.project_name || "No project"} · received {fmt(r.created_at)}</span>
              </div>
              <span className="studioRowAction studioRowNew">New →</span>
            </Link>
          ))}
          {(pricingRequests || []).map((r: any) => (
            <Link href={`/studio/requests/${r.id}`} key={r.id} className="studioRow">
              <div className="studioRowInfo">
                <b>{r.request_code} · {r.company_name || r.name || "Untitled"}</b>
                <span>{r.project_name || "No project"}</span>
              </div>
              <span className="studioRowAction">Pricing →</span>
            </Link>
          ))}
        </section>
      )}

      {allClear && (
        <section className="studioCard studioAllClear">
          <p>All clear — nothing urgent today.</p>
          <Link href="/studio/requests" className="studioTextLink">Check requests →</Link>
        </section>
      )}
    </div>
  );
}
