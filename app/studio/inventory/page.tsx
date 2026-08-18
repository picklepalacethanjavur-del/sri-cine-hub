import { requireStaff } from "@/lib/auth";
import { InventoryManager } from "@/app/admin/inventory/InventoryManager";

export default async function StudioInventory() {
  const { supabase } = await requireStaff();
  const [{ data: cameras }, { data: accessories }] = await Promise.all([
    supabase.from("cameras").select("*").order("camera_code"),
    supabase.from("accessories").select("*").order("accessory_code"),
  ]);
  return (
    <div className="studioPage studioPageWide">
      <div className="studioPageHeader">
        <p className="studioEyebrow">ASSETS</p>
        <h1 className="studioH1">Inventory</h1>
      </div>
      <InventoryManager cameras={cameras || []} accessories={accessories || []} />
    </div>
  );
}
