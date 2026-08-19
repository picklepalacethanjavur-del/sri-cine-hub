import {notFound} from "next/navigation";import Link from "next/link";import {AdminNav} from "@/components/AdminNav";import {RequestDocuments} from "@/components/RequestDocuments";import {requireStaff} from "@/lib/auth";import {QuotationEditor} from "./QuotationEditor";
export default async function QuotationDetail({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const {supabase,user,profile}=await requireStaff();
 const [{data:q},{data:items},{data:requestWrap},{data:cameras},{data:accessories},{data:kits},{data:rates},{data:supplierItems}]=await Promise.all([
  supabase.from("quotations").select("*,customers(*)").eq("id",id).single(),
  supabase.from("quotation_items").select("*,suppliers(company_name)").eq("quotation_id",id).order("sort_order"),
  supabase.from("quotations").select("quote_request_id,quote_requests(*)").eq("id",id).single(),
  supabase.from("cameras").select("id,camera_code,name,manufacturer,model,catalog_item_id").order("camera_code"),
  supabase.from("accessories").select("id,accessory_code,name,category,catalog_item_id").order("accessory_code"),
  supabase.from("equipment_kits").select("id,kit_code,name,internal_daily_rate_inr").eq("is_active",true).order("kit_code"),
  supabase.from("internal_rates").select("*").order("effective_from",{ascending:false}),
  supabase.from("supplier_catalog_items").select("id,supplier_id,catalog_item_id,supplier_item_name,category,quantity_available,default_cost_inr,rate_basis,location,is_active,suppliers(company_name)").eq("is_active",true).order("supplier_item_name")
 ]);
 if(!q)notFound();const request=(requestWrap as any)?.quote_requests||null;const {data:attachments}=q.quote_request_id?await supabase.from("quote_request_attachments").select("id,file_name,file_path,content_type,file_size,created_at").eq("quote_request_id",q.quote_request_id).order("created_at",{ascending:false}):{data:[] as any[]};
 const isAdmin = profile.role === "admin";
 return <section className="adminShell v6AdminShell"><div className="eyebrow">QUOTATION</div><div className="detailTitleRow"><div><h1>{q.quotation_code}</h1><p>{q.customers?.company_name||q.customers?.name||request?.company_name||request?.name||"Customer not entered"}</p></div><div className="detailActions"><Link className="button ghost" href={`/admin/quotations/${id}/print`}>View Document</Link></div></div><AdminNav/>{q.quote_request_id&&<RequestDocuments requestId={q.quote_request_id} attachments={attachments||[]} userId={user.id} compact/>}<QuotationEditor quotation={q} items={items||[]} request={request} cameras={cameras||[]} accessories={accessories||[]} kits={kits||[]} rates={rates||[]} supplierItems={supplierItems||[]} isAdmin={isAdmin}/></section>;
}
