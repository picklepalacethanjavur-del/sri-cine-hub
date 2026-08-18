import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { requireStaff } from "@/lib/auth";

export default async function Sourcing() {
  const { supabase } = await requireStaff();

  const [{ data: suppliers }, { data: rfqs }, { data: subrentals }] = await Promise.all([
    supabase.from("suppliers").select("id").eq("is_active", true),
    supabase.from("supplier_rfqs").select("id,status").in("status", ["draft", "sent"]),
    supabase.from("booking_subrentals").select("id,status").not("status", "in", '("cancelled","returned")'),
  ]);

  return (
    <section className="adminShell">
      <div className="eyebrow">EXTERNAL EQUIPMENT</div>
      <h1>Sourcing</h1>
      <AdminNav />

      <div className="hubGrid">
        <Link href="/admin/suppliers" className="hubCard">
          <div className="hubCardCount">{suppliers?.length || 0}</div>
          <h2>Suppliers</h2>
          <p>Active supplier network and their equipment catalogs.</p>
          <span className="hubCardLink">Open Suppliers →</span>
        </Link>

        <Link href="/admin/supplier-rfqs" className="hubCard">
          <div className="hubCardCount">{rfqs?.length || 0}</div>
          <h2>Supplier RFQs</h2>
          <p>Open requests for quotation sent to suppliers.</p>
          <span className="hubCardLink">Open RFQs →</span>
        </Link>

        <Link href="/admin/sub-rentals" className="hubCard">
          <div className="hubCardCount">{subrentals?.length || 0}</div>
          <h2>Sub-Rentals</h2>
          <p>External equipment attached to active customer bookings.</p>
          <span className="hubCardLink">Open Sub-Rentals →</span>
        </Link>
      </div>
    </section>
  );
}
