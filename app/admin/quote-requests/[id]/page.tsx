import { notFound } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { requireStaff } from "@/lib/auth";
import { RequestDocuments } from "@/components/RequestDocuments";
import { PricingWorkspace } from "./PricingWorkspace";

export default async function QuoteRequestDetail({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const {supabase,user}=await requireStaff();

  const [{data:req},{data:cameras},{data:accessories},{data:kits},{data:rates},{data:existingQuotes},{data:attachments}] = await Promise.all([
    supabase.from("quote_requests").select("*").eq("id",id).single(),
    supabase.from("cameras").select("id,camera_code,name,status").order("camera_code"),
    supabase.from("accessories").select("id,accessory_code,name,category,status").order("accessory_code"),
    supabase.from("equipment_kits").select("id,kit_code,name,internal_daily_rate_inr").eq("is_active",true).order("kit_code"),
    supabase.from("internal_rates").select("*").order("effective_from",{ascending:false}),
    supabase.from("quotations").select("id,quotation_code,status,total_inr,created_at").eq("quote_request_id",id).order("created_at",{ascending:false}),
    supabase.from("quote_request_attachments").select("id,file_name,file_path,content_type,file_size,created_at").eq("quote_request_id",id).order("created_at",{ascending:false})
  ]);

  if(!req) notFound();

  return <section className="adminShell">
    <div className="eyebrow">QUOTE REQUEST {req.request_code}</div>
    <h1>{req.company_name||req.name} · {req.project_name||"Project"}</h1>
    <AdminNav/>
    <RequestDocuments requestId={id} attachments={attachments||[]} userId={user.id}/>
    <PricingWorkspace request={req} cameras={cameras||[]} accessories={accessories||[]} kits={kits||[]} rates={rates||[]} existingQuotes={existingQuotes||[]}/>
  </section>;
}
