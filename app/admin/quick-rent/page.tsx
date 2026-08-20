import { requireStaff } from "@/lib/auth";
import { AdminNav } from "@/components/AdminNav";
import { QuickRentForm } from "./QuickRentForm";

export default async function QuickRentPage() {
  const { supabase } = await requireStaff();
  const [{ data: cameras }, { data: accessories }, { data: rates }] = await Promise.all([
    supabase.from("cameras").select("id,camera_code,name,manufacturer").order("camera_code"),
    supabase.from("accessories").select("id,accessory_code,name,category").order("accessory_code"),
    supabase.from("internal_rates").select("camera_id,accessory_id,daily_rate_inr").order("effective_from", { ascending: false }),
  ]);

  return (
    <section className="adminShell v6AdminShell">
      <div className="eyebrow">WALK-IN</div>
      <h1>Quick Rent</h1>
      <AdminNav />
      <QuickRentForm cameras={cameras || []} accessories={accessories || []} rates={rates || []} />
    </section>
  );
}
