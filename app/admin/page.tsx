import { requireStaff } from "@/lib/auth";
import Link from "next/link";

function fmt(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function Today() {
  const { supabase, user, profile } = await requireStaff();
  await supabase.rpc("sync_overdue_bookings");

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);

  const [
    { data: cameras },
    { data: allBookings },
    { data: newRequests },
    { data: pricingRequests },
  ] = await Promise.all([
    supabase.from("cameras").select("id,status"),
    supabase
      .from("bookings")
      .select("id,booking_code,production_name,project_name,start_at,end_at,status,customers(name,company_name)")
      .in("status", ["reserved", "confirmed", "preparing", "checked_out", "overdue"])
      .order("start_at", { ascending: true }),
    supabase.from("quote_requests").select("id,request_code,company_name,name,project_name,start_at,created_at").eq("status", "new").order("created_at", { ascending: true }),
    supabase.from("quote_requests").select("id,request_code,company_name,name,project_name,start_at,created_at").eq("status", "reviewing").order("created_at", { ascending: true }),
  ]);

  const cams = cameras || [];
  const books = allBookings || [];

  const checkoutsToday = books.filter((b: any) =>
    ["reserved", "confirmed", "preparing"].includes(b.status) &&
    b.start_at >= todayStr && b.start_at < tomorrowStr
  );
  const overdueCheckouts = books.filter((b: any) =>
    ["reserved", "confirmed", "preparing"].includes(b.status) &&
    b.start_at < todayStr
  );
  const returnsToday = books.filter((b: any) =>
    b.status === "checked_out" &&
    b.end_at >= todayStr && b.end_at < tomorrowStr
  );
  const overdueReturns = books.filter((b: any) => b.status === "overdue");

  const allClear =
    checkoutsToday.length === 0 && overdueCheckouts.length === 0 &&
    returnsToday.length === 0 && overdueReturns.length === 0 &&
    (newRequests?.length || 0) === 0 && (pricingRequests?.length || 0) === 0;

  return (
    <section className="adminShell">
      <div className="eyebrow">SRI CINE HUB</div>
      <h1>Today</h1>
      <p>{profile.full_name || user.email}</p>


      <div className="metricGrid">
        <div className="metric"><span>Available</span><b>{cams.filter((c: any) => c.status === "available").length}</b></div>
        <div className="metric"><span>Out now</span><b>{cams.filter((c: any) => c.status === "out").length}</b></div>
        <div className="metric"><span>Overdue returns</span><b>{overdueReturns.length}</b></div>
        <div className="metric"><span>Needs pricing</span><b>{(newRequests?.length || 0) + (pricingRequests?.length || 0)}</b></div>
      </div>

      {(checkoutsToday.length > 0 || overdueCheckouts.length > 0) && (
        <div className="adminPanel todaySection">
          <h2>
            Checkouts due today
            {overdueCheckouts.length > 0 && <span className="todayBadge overdue">{overdueCheckouts.length} overdue</span>}
          </h2>
          {overdueCheckouts.map((b: any) => (
            <Link href={`/admin/operations?booking=${b.id}`} className="todayRow urgent" key={b.id}>
              <div>
                <b>{b.booking_code} · {b.customers?.company_name || b.customers?.name || b.production_name}</b>
                <span>{b.project_name} · started {fmt(b.start_at)}</span>
              </div>
              <em className="status overdue">OVERDUE CHECKOUT →</em>
            </Link>
          ))}
          {checkoutsToday.map((b: any) => (
            <Link href={`/admin/operations?booking=${b.id}`} className="todayRow" key={b.id}>
              <div>
                <b>{b.booking_code} · {b.customers?.company_name || b.customers?.name || b.production_name}</b>
                <span>{b.project_name} · {fmt(b.start_at)}</span>
              </div>
              <em className={`status ${b.status}`}>Go to Checkout →</em>
            </Link>
          ))}
        </div>
      )}

      {(returnsToday.length > 0 || overdueReturns.length > 0) && (
        <div className="adminPanel todaySection">
          <h2>
            Returns due today
            {overdueReturns.length > 0 && <span className="todayBadge overdue">{overdueReturns.length} overdue</span>}
          </h2>
          {overdueReturns.map((b: any) => (
            <Link href={`/admin/operations?booking=${b.id}`} className="todayRow urgent" key={b.id}>
              <div>
                <b>{b.booking_code} · {b.customers?.company_name || b.customers?.name || b.production_name}</b>
                <span>{b.project_name} · was due {fmt(b.end_at)}</span>
              </div>
              <em className="status overdue">OVERDUE RETURN →</em>
            </Link>
          ))}
          {returnsToday.map((b: any) => (
            <Link href={`/admin/operations?booking=${b.id}`} className="todayRow" key={b.id}>
              <div>
                <b>{b.booking_code} · {b.customers?.company_name || b.customers?.name || b.production_name}</b>
                <span>{b.project_name} · due {fmt(b.end_at)}</span>
              </div>
              <em className="status checked_out">Go to Return →</em>
            </Link>
          ))}
        </div>
      )}

      {((newRequests?.length || 0) + (pricingRequests?.length || 0)) > 0 && (
        <div className="adminPanel todaySection">
          <h2>Quotes needing attention</h2>
          {(newRequests || []).map((r: any) => (
            <Link href={`/studio/requests/${r.id}`} className="todayRow" key={r.id}>
              <div>
                <b>{r.request_code} · {r.company_name || r.name || "Untitled"}</b>
                <span>{r.project_name || "No project name"} · received {fmt(r.created_at)}</span>
              </div>
              <em className="status new">New — Build Quote →</em>
            </Link>
          ))}
          {(pricingRequests || []).map((r: any) => (
            <Link href={`/studio/requests/${r.id}`} className="todayRow" key={r.id}>
              <div>
                <b>{r.request_code} · {r.company_name || r.name || "Untitled"}</b>
                <span>{r.project_name || "No project name"}</span>
              </div>
              <em className="status reviewing">In Pricing →</em>
            </Link>
          ))}
        </div>
      )}

      {allClear && (
        <div className="adminPanel">
          <p className="muted">Nothing urgent for today. Check <Link href="/admin/deals">Deals</Link> for the full pipeline.</p>
        </div>
      )}
    </section>
  );
}
