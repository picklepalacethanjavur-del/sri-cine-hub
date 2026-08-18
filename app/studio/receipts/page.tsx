import Link from "next/link";
import { requireStaff } from "@/lib/auth";

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default async function StudioReceipts() {
  const { supabase } = await requireStaff();
  const { data } = await supabase
    .from("receipts")
    .select("id,receipt_code,amount_paid_inr,balance_inr,issued_at,bookings(booking_code,production_name,project_name),customers(name,company_name)")
    .order("issued_at", { ascending: false });

  return (
    <div className="studioPage">
      <div className="studioPageHeader">
        <p className="studioEyebrow">DOCUMENTS</p>
        <h1 className="studioH1">Receipts</h1>
      </div>

      <section className="studioCard">
        {(data || []).length === 0 && <p className="studioEmpty">No receipts yet.</p>}
        {(data || []).map((r: any) => (
          <Link href={`/admin/receipts/${r.id}/print`} key={r.id} className="studioRow">
            <div className="studioRowInfo">
              <b>{r.receipt_code} · {r.customers?.company_name || r.customers?.name || "Customer"}</b>
              <span>{r.bookings?.booking_code} · {r.bookings?.project_name} · {r.issued_at ? new Date(r.issued_at).toLocaleDateString("en-IN") : "—"}</span>
            </div>
            <div className="studioRowRight">
              <strong>{money(r.amount_paid_inr)}</strong>
              {Number(r.balance_inr) > 0 && <span className="studioBalanceDue">Balance {money(r.balance_inr)}</span>}
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
