import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { requireStaff } from "@/lib/auth";

export default async function Setup() {
  const { supabase } = await requireStaff();

  const [{ data: cameras }, { data: accessories }, { data: kits }] = await Promise.all([
    supabase.from("cameras").select("id,status"),
    supabase.from("accessories").select("id"),
    supabase.from("kits").select("id"),
  ]);

  const availableCams = (cameras || []).filter((c: any) => c.status === "available").length;
  const totalAssets = (cameras?.length || 0) + (accessories?.length || 0);

  return (
    <section className="adminShell">
      <div className="eyebrow">CATALOG & CONFIGURATION</div>
      <h1>Setup</h1>
      <AdminNav />

      <div className="hubGrid">
        <Link href="/admin/inventory" className="hubCard">
          <div className="hubCardCount">{totalAssets}</div>
          <h2>Inventory</h2>
          <p>Cameras and accessories with QR codes. {availableCams} available now.</p>
          <span className="hubCardLink">Open Inventory →</span>
        </Link>

        <Link href="/admin/kits" className="hubCard">
          <div className="hubCardCount">{kits?.length || 0}</div>
          <h2>Kits</h2>
          <p>Predefined equipment packages for faster quote building.</p>
          <span className="hubCardLink">Open Kits →</span>
        </Link>

        <Link href="/admin/rates" className="hubCard">
          <h2>Internal Rates</h2>
          <p>Your internal pricing used when building quotations.</p>
          <span className="hubCardLink">Open Rates →</span>
        </Link>
      </div>

      <div className="hubGrid">
        <Link href="/investors" className="hubCard">
          <h2>Investors</h2>
          <p>Financial overview and investor summary.</p>
          <span className="hubCardLink">Open →</span>
        </Link>
      </div>
    </section>
  );
}
