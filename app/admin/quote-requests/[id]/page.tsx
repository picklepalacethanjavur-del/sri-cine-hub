import {notFound} from "next/navigation";
import {AdminNav} from "@/components/AdminNav";
import {requireStaff} from "@/lib/auth";
import {RequestDocuments} from "@/components/RequestDocuments";
import {PricingWorkspace} from "./PricingWorkspace";

export default async function QuoteRequestDetail({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const {supabase,user}=await requireStaff();
  const [{data:req},{data:cameras},{data:accessories},{data:kits},{data:rates},{data:supplierItems},{data:existingQuotes},{data:attachments}]=await Promise.all([
    supabase.from("quote_requests").select("*").eq("id",id).single(),
    supabase.from("cameras").select("id,camera_code,name,manufacturer,model,status,catalog_item_id").order("camera_code"),
    supabase.from("accessories").select("id,accessory_code,name,category,status,catalog_item_id").order("accessory_code"),
    supabase.from("equipment_kits").select("id,kit_code,name,internal_daily_rate_inr").eq("is_active",true).order("kit_code"),
    supabase.from("internal_rates").select("*").order("effective_from",{ascending:false}),
    supabase.from("supplier_catalog_items").select("id,supplier_id,catalog_item_id,supplier_item_name,category,quantity_available,default_cost_inr,rate_basis,location,is_active,suppliers(company_name)").eq("is_active",true).order("supplier_item_name"),
    supabase.from("quotations").select("id,quotation_code,status,total_inr,created_at").eq("quote_request_id",id).order("created_at",{ascending:false}),
    supabase.from("quote_request_attachments").select("id,file_name,file_path,content_type,file_size,created_at").eq("quote_request_id",id).order("created_at",{ascending:false})
  ]);
  if(!req)notFound();
  return <section className="adminShell v6AdminShell"><div className="eyebrow">QUOTE REQUEST {req.request_code}</div><h1>{req.company_name||req.name||"Untitled Request"}</h1><AdminNav/><RequestDocuments requestId={id} attachments={attachments||[]} userId={user.id} compact/><PricingWorkspace request={req} cameras={cameras||[]} accessories={accessories||[]} kits={kits||[]} rates={rates||[]} supplierItems={supplierItems||[]} existingQuotes={existingQuotes||[]}/></section>;
}
