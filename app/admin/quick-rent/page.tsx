import { requireStaff } from "@/lib/auth";
import { AdminNav } from "@/components/AdminNav";
import { QuickRentForm } from "./QuickRentForm";

export default async function QuickRentPage() {
  const { supabase } = await requireStaff();
  const [{ data: cameras }, { data: rates }] = await Promise.all([
    supabase.from("cameras").select("id,camera_code,name,manufacturer,catalog_item_id").eq("status", "available").order("camera_code"),
    supabase.from("internal_rates").select("catalog_item_id,daily_rate_inr").order("effective_from", { ascending: false }),
  ]);

  return (
    <section className="adminShell v6AdminShell">
      <div className="eyebrow">WALK-IN</div>
      <h1>Quick Rent</h1>
      <AdminNav />
      <QuickRentForm cameras={cameras || []} rates={rates || []} />
    </section>
  );
}
