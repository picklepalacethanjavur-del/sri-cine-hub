"use client";
import {useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {QuotationLineEditor,type QuotationRow,type SourceType,type RateBasis} from "@/components/QuotationLineEditor";

const money=(n:number)=>`₹${Number(n||0).toLocaleString("en-IN")}`;
function rentalDays(request:any){if(!request?.start_at||!request?.end_at)return 1;const a=new Date(request.start_at).getTime(),b=new Date(request.end_at).getTime();return b>a?Math.max(1,Math.ceil((b-a)/86400000)):1;}

export function QuotationEditor({quotation,items,request,cameras,accessories,kits,rates,supplierItems}:any){
  const supabase=createClient();const defaultRentalDays=rentalDays(request);
  const [rows,setRows]=useState<QuotationRow[]>(items.map((x:any)=>({
    key:x.id,item_type:x.item_type,item_id:x.item_id||null,request_item_id:x.request_item_id||null,catalog_item_id:x.catalog_item_id||null,supplier_id:x.supplier_id||null,supplier_catalog_item_id:x.supplier_catalog_item_id||null,
    section_name:x.section_name||"General",requested_description:x.requested_description||x.description||"",description:x.description||"",source_type:(x.source_type==="sub_rental"?"supplier":x.source_type||"manual") as SourceType,
    quantity:Number(x.quantity||0),rental_days:Number(x.rental_days||0),internal_rate_inr:Number(x.internal_rate_inr||0),cost_rate_inr:Number(x.cost_rate_inr||x.supplier_cost_inr||0),cost_rate_basis:(x.cost_rate_basis||x.supplier_rate_type||"daily") as RateBasis,
    quoted_rate_inr:Number(x.unit_rate_inr||0),supplier_name:x.suppliers?.company_name||x.supplier_name||"",supplier_status:x.supplier_status||"not_required",supplier_reference:x.supplier_reference||"",notes:x.notes||""
  })));
  const [discount,setDiscount]=useState(Number(quotation.discount_inr||0));const [tax,setTax]=useState(Number(quotation.tax_inr||0));const [otherCharges,setOtherCharges]=useState(Number(quotation.other_charges_inr||0));
  const [customerNotes,setCustomerNotes]=useState(quotation.customer_notes||"");const [internalNotes,setInternalNotes]=useState(quotation.internal_notes||"");
  const [savingAction,setSavingAction]=useState<"draft"|"generate"|null>(null);const [message,setMessage]=useState("");const saving=!!savingAction;
  const subtotal=rows.reduce((n,r)=>n+(r.quantity||0)*(r.rental_days||0)*(r.quoted_rate_inr||0),0);const total=Math.max(0,subtotal-discount+tax+otherCharges);
  function rpcItems(){return rows.map((r,i)=>({...r,item_id:r.item_id||"",request_item_id:r.request_item_id||"",catalog_item_id:r.catalog_item_id||"",supplier_id:r.supplier_id||"",supplier_catalog_item_id:r.supplier_catalog_item_id||"",sort_order:i}));}
  async function saveWithStatus(targetStatus:"draft"|"generated"){
    if(quotation.status==="converted"){setMessage("Converted quotations are locked.");return;}
    setSavingAction(targetStatus==="generated"?"generate":"draft");setMessage("");
    try{const {error}=await supabase.rpc("save_quotation_atomic",{p_quotation_id:quotation.id,p_status:targetStatus,p_discount_inr:discount,p_tax_inr:tax,p_other_charges_inr:otherCharges,p_customer_notes:customerNotes||null,p_internal_notes:internalNotes||null,p_items:rpcItems()});if(error)throw error;if(targetStatus==="generated")location.href=`/admin/quotations/${quotation.id}/print?generated=1`;else{setMessage("Draft saved.");setTimeout(()=>location.reload(),450);}}catch(e){setMessage(e instanceof Error?e.message:"Unable to save quotation.");setSavingAction(null);}
  }
  return <>
    <div className="quotationEditRibbon"><span className={`workflowBadge ${quotation.status}`}>{String(quotation.status).replaceAll("_"," ").toUpperCase()}</span><span>Supplier costs and internal margins remain private.</span></div>
    <QuotationLineEditor rows={rows} onChange={setRows} cameras={cameras} accessories={accessories} kits={kits} rates={rates} supplierItems={supplierItems} defaultRentalDays={defaultRentalDays} discount={discount} tax={tax} otherCharges={otherCharges} onDiscount={setDiscount} onTax={setTax} onOtherCharges={setOtherCharges}/>
    <div className="v6QuoteFooterBar"><details className="quoteOptionalDetails"><summary>Optional details</summary><div className="optionalDetailsGrid"><label>Customer note<textarea rows={3} value={customerNotes} onChange={e=>setCustomerNotes(e.target.value)} placeholder="Optional"/></label><label>Internal note<textarea rows={3} value={internalNotes} onChange={e=>setInternalNotes(e.target.value)} placeholder="Never shown to customer"/></label></div></details><div className="v6FooterActions"><div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}><div><span>Grand Total</span><b>{money(total)}</b></div><button className="button ghost" type="button" disabled={saving||quotation.status==="converted"} onClick={()=>void saveWithStatus("draft")}>{savingAction==="draft"?"Saving…":"Save Draft"}</button><button className="button gold" type="button" disabled={saving||quotation.status==="converted"} onClick={()=>void saveWithStatus("generated")}>{savingAction==="generate"?"Generating…":"Generate Updated Quotation"}</button><a className="button ghost" href={`/admin/quotations/${quotation.id}/print`}>View Document</a></div></div></div>
    {message&&<div className={message.includes("saved")?"successBox":"errorBox"}>{message}</div>}
    {saving&&<div className="actionOverlay" role="status"><div className="actionOverlayCard"><span className="loadingSpinner"/><b>{savingAction==="generate"?"Generating updated quotation…":"Saving draft…"}</b></div></div>}
  </>;
}
