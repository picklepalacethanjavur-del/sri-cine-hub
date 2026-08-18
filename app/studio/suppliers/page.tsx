import { requireStaff } from "@/lib/auth";
import { SupplierManager } from "@/app/admin/suppliers/SupplierManager";

export default async function StudioSuppliers() {
  const { supabase } = await requireStaff();
  const [{ data: suppliers }, { data: items }, { data: catalog }] = await Promise.all([
    supabase.from("suppliers").select("*").order("company_name"),
    supabase.from("supplier_catalog_items").select("*,suppliers(company_name),master_equipment_catalog(canonical_name,category)").order("supplier_item_name"),
    supabase.from("master_equipment_catalog").select("*").eq("is_active", true).order("category").order("canonical_name"),
  ]);
  return (
    <div className="studioPage studioPageWide">
      <div className="studioPageHeader">
        <p className="studioEyebrow">SOURCING</p>
        <h1 className="studioH1">Vendor Catalog</h1>
      </div>
      <SupplierManager suppliers={suppliers || []} items={items || []} catalog={catalog || []} />
    </div>
  );
}
