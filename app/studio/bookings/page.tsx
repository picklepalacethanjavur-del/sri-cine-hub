import Link from "next/link";
import { requireStaff } from "@/lib/auth";

const STATUS_GROUPS: Record<string, string[]> = {
  "Active": ["reserved", "confirmed", "preparing"],
  "Out": ["checked_out", "overdue"],
  "Completed": ["returned"],
};

function statusLabel(s: string) {
  const m: Record<string, string> = { reserved: "Reserved", confirmed: "Confirmed", preparing: "Preparing", checked_out: "Out Now", overdue: "Overdue", returned: "Returned", cancelled: "Cancelled" };
  return m[s] || s;
}

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default async function StudioBookings() {
  const { supabase } = await requireStaff();
  await supabase.rpc("sync_overdue_bookings");
  const { data } = await supabase
    .from("bookings")
    .select("id,booking_code,status,production_name,project_name,start_at,end_at,quoted_total_inr,customers(name,company_name)")
    .not("status", "eq", "cancelled")
    .order("start_at", { ascending: false });
  const books = data || [];

  return (
    <div className="studioPage">
      <div className="studioPageHeader">
        <p className="studioEyebrow">RESERVATIONS</p>
        <h1 className="studioH1">Bookings</h1>
      </div>

      {Object.entries(STATUS_GROUPS).map(([group, statuses]) => {
        const rows = books.filter((b: any) => statuses.includes(b.status));
        if (!rows.length) return null;
        return (
          <section className="studioCard" key={group}>
            <h2 className="studioCardTitle">{group} <span className="studioCardCount">{rows.length}</span></h2>
            {rows.map((b: any) => (
              <Link
                href={["checked_out","overdue"].includes(b.status) ? `/studio/ops?booking=${b.id}` : `/admin/bookings/${b.id}`}
                key={b.id}
                className="studioRow"
              >
                <div className="studioRowInfo">
                  <b>{b.booking_code} · {b.customers?.company_name || b.customers?.name || b.production_name}</b>
                  <span>{b.project_name} · {new Date(b.start_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} → {new Date(b.end_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                </div>
                <div className="studioRowRight">
                  {b.quoted_total_inr ? <strong>{money(b.quoted_total_inr)}</strong> : null}
                  <span className={`studioBadge ${b.status}`}>{statusLabel(b.status)}</span>
                </div>
              </Link>
            ))}
          </section>
        );
      })}
    </div>
  );
}
