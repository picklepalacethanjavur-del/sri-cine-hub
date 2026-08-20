import Link from "next/link";
import { requireStaff } from "@/lib/auth";

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function stageLabel(status: string) {
  const map: Record<string, string> = {
    new: "New Request", reviewing: "Pricing", quoted: "Quote Sent",
    converted: "Converted", closed: "Closed",
    reserved: "Reserved", confirmed: "Confirmed", preparing: "Preparing",
    checked_out: "Out Now", overdue: "Overdue", returned: "Returned", cancelled: "Cancelled",
    draft: "Draft", generated: "Generated", sent: "Sent", accepted: "Accepted",
  };
  return map[status] || status;
}

export default async function Deals() {
  const { supabase } = await requireStaff();

  const [{ data: requests }, { data: bookings }, { data: quotations }] = await Promise.all([
    supabase
      .from("quote_requests")
      .select("id,request_code,status,company_name,name,project_name,start_at,created_at")
      .in("status", ["new", "reviewing"])
      .order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select("id,booking_code,status,production_name,project_name,start_at,end_at,quoted_total_inr,customers(name,company_name)")
      .not("status", "eq", "cancelled")
      .order("start_at", { ascending: false }),
    supabase
      .from("quotations")
      .select("id,quotation_code,status,total_inr,created_at,customers(name,company_name),quote_requests(project_name)")
      .in("status", ["draft", "generated", "sent", "accepted"])
      .order("created_at", { ascending: false }),
  ]);

  const activeBookings = (bookings || []).filter((b: any) => b.status !== "returned");
  const doneBookings = (bookings || []).filter((b: any) => b.status === "returned");

  return (
    <section className="adminShell">
      <div className="eyebrow">PIPELINE</div>
      <h1>Deals</h1>
      

      <div className="metricGrid">
        <div className="metric"><span>Open requests</span><b>{(requests || []).length}</b></div>
        <div className="metric"><span>Quotes out</span><b>{(quotations || []).length}</b></div>
        <div className="metric"><span>Active bookings</span><b>{activeBookings.length}</b></div>
        <div className="metric"><span>Completed</span><b>{doneBookings.length}</b></div>
      </div>

      {(requests || []).length > 0 && (
        <div className="adminPanel">
          <div className="panelHeading"><h2>Requests — waiting for quote</h2><Link className="button ghost" href="/admin/quote-requests">All Requests</Link></div>
          {(requests || []).map((r: any) => (
            <Link href={`/studio/requests/${r.id}`} className="dealRow" key={r.id}>
              <span className={`stageDot request`} />
              <div className="dealInfo">
                <b>{r.request_code} · {r.company_name || r.name || "Untitled"}</b>
                <span>{r.project_name || "No project"}</span>
              </div>
              <em className={`workflowBadge ${r.status}`}>{stageLabel(r.status)}</em>
            </Link>
          ))}
        </div>
      )}

      {(quotations || []).length > 0 && (
        <div className="adminPanel">
          <div className="panelHeading"><h2>Quotations — awaiting acceptance</h2><Link className="button ghost" href="/admin/quotations">All Quotations</Link></div>
          {(quotations || []).map((q: any) => (
            <Link href={`/admin/quotations/${q.id}/print`} className="dealRow" key={q.id}>
              <span className="stageDot quote" />
              <div className="dealInfo">
                <b>{q.quotation_code} · {q.customers?.company_name || q.customers?.name || "Customer"}</b>
                <span>{q.quote_requests?.project_name || "Project"}</span>
              </div>
              <div className="dealRight">
                <strong>{money(q.total_inr)}</strong>
                <em className={`workflowBadge ${q.status}`}>{stageLabel(q.status)}</em>
              </div>
            </Link>
          ))}
        </div>
      )}

      {activeBookings.length > 0 && (
        <div className="adminPanel">
          <div className="panelHeading"><h2>Bookings — active</h2><Link className="button ghost" href="/admin/bookings">All Bookings</Link></div>
          {activeBookings.map((b: any) => (
            <Link
              href={["checked_out", "overdue"].includes(b.status) ? `/admin/operations?booking=${b.id}` : `/admin/bookings/${b.id}`}
              className="dealRow"
              key={b.id}
            >
              <span className={`stageDot ${["checked_out", "overdue"].includes(b.status) ? "active" : "booking"}`} />
              <div className="dealInfo">
                <b>{b.booking_code} · {b.customers?.company_name || b.customers?.name || b.production_name}</b>
                <span>{b.project_name} · {b.start_at ? new Date(b.start_at).toLocaleDateString("en-IN") : "—"} → {b.end_at ? new Date(b.end_at).toLocaleDateString("en-IN") : "—"}</span>
              </div>
              <div className="dealRight">
                {b.quoted_total_inr ? <strong>{money(b.quoted_total_inr)}</strong> : null}
                <em className={`status ${b.status}`}>{stageLabel(b.status)}</em>
              </div>
            </Link>
          ))}
        </div>
      )}

      {doneBookings.length > 0 && (
        <div className="adminPanel">
          <div className="panelHeading"><h2>Completed</h2><Link className="button ghost" href="/admin/receipts">All Receipts</Link></div>
          {doneBookings.slice(0, 20).map((b: any) => (
            <Link href={`/admin/bookings/${b.id}`} className="dealRow" key={b.id}>
              <span className="stageDot done" />
              <div className="dealInfo">
                <b>{b.booking_code} · {b.customers?.company_name || b.customers?.name || b.production_name}</b>
                <span>{b.project_name}</span>
              </div>
              <em className="status returned">Returned</em>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
