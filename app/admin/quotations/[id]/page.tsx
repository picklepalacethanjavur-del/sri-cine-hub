import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { requireStaff } from "@/lib/auth";
import { QuotationEditor } from "./QuotationEditor";

export default async function QuotationDetail({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const {supabase}=await requireStaff();
  const [{data:q},{data:items},{data:request},{data:cameras},{data:accessories},{data:kits},{data:rates}] = await Promise.all([
    supabase.from("quotations").select("*,customers(*)").eq("id",id).single(),
    supabase.from("quotation_items").select("*").eq("quotation_id",id).order("sort_order"),
    supabase.from("quotations").select("quote_request_id,quote_requests(*)").eq("id",id).single(),
    supabase.from("cameras").select("id,camera_code,name").order("camera_code"),
    supabase.from("accessories").select("id,accessory_code,name").order("accessory_code"),
    supabase.from("equipment_kits").select("id,kit_code,name,internal_daily_rate_inr").eq("is_active",true).order("kit_code"),
    supabase.from("internal_rates").select("*").order("effective_from",{ascending:false})
  ]);
  if(!q) notFound();

  return <section className="adminShell">
    <div className="eyebrow">QUOTATION</div>
    <div className="detailTitleRow">
      <div><h1>{q.quotation_code}</h1><p>{q.customers?.company_name||q.customers?.name||"Customer"}</p></div>
      <div className="detailActions">
        <Link className="button ghost" href={`/admin/quotations/${id}/print`}>Print / Save PDF</Link>
      </div>
    </div>
    <AdminNav/>
    <QuotationEditor quotation={q} items={items||[]} request={(request as any)?.quote_requests||null} cameras={cameras||[]} accessories={accessories||[]} kits={kits||[]} rates={rates||[]}/>
  </section>;
}
