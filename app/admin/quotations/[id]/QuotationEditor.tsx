"use client";
import {useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {QuotationLineEditor,type QuotationRow} from "@/components/QuotationLineEditor";

const money=(n:number)=>`₹${Number(n||0).toLocaleString("en-IN")}`;

export function QuotationEditor({quotation,items,request,cameras,accessories,kits,rates}:any){
  const supabase=createClient();
  const defaultRentalDays=request?Math.max(1,Math.ceil((new Date(request.end_at).getTime()-new Date(request.start_at).getTime())/86400000)):1;
  const [rows,setRows]=useState<QuotationRow[]>(items.map((x:any)=>({
    key:x.id,item_type:x.item_type,item_id:x.item_id||null,section_name:x.section_name||"General",requested_description:x.requested_description||x.description||"",description:x.description||"",source_type:x.source_type||((x.item_type==="service")?"service":(x.item_type==="other"?"manual":"own")),quantity:Number(x.quantity||1),rental_days:Number(x.rental_days||1),internal_rate_inr:Number(x.internal_rate_inr||0),quoted_rate_inr:Number(x.unit_rate_inr||0),supplier_name:x.supplier_name||"",supplier_cost_inr:Number(x.supplier_cost_inr||0),supplier_rate_type:x.supplier_rate_type||"daily",supplier_status:x.supplier_status||"not_required",supplier_reference:x.supplier_reference||"",notes:x.notes||""
  })));
  const [discount,setDiscount]=useState(Number(quotation.discount_inr||0));
  const [tax,setTax]=useState(Number(quotation.tax_inr||0));
  const [otherCharges,setOtherCharges]=useState(Number(quotation.other_charges_inr||0));
  const [customerNotes,setCustomerNotes]=useState(quotation.customer_notes||"");
  const [internalNotes,setInternalNotes]=useState(quotation.internal_notes||"");
  const [savingAction,setSavingAction]=useState<"draft"|"generate"|null>(null);
  const [message,setMessage]=useState("");
  const saving=!!savingAction;
  const subtotal=rows.reduce((n,r)=>n+r.quantity*r.rental_days*r.quoted_rate_inr,0);
  const total=Math.max(0,subtotal-discount+tax+otherCharges);

  function rpcItems(){return rows.map((r,i)=>({...r,item_id:r.item_id||"",sort_order:i}));}

  async function saveWithStatus(targetStatus:"draft"|"generated"){
    if(!rows.length){setMessage("Add at least one quotation item.");return;}
    if(quotation.status==="converted"){setMessage("Converted quotations are locked.");return;}
    setSavingAction(targetStatus==="generated"?"generate":"draft");setMessage("");
    try{
      const {error}=await supabase.rpc("save_quotation_atomic",{p_quotation_id:quotation.id,p_status:targetStatus,p_discount_inr:discount,p_tax_inr:tax,p_other_charges_inr:otherCharges,p_customer_notes:customerNotes,p_internal_notes:internalNotes,p_items:rpcItems()});
      if(error)throw error;
      if(targetStatus==="generated")location.href=`/admin/quotations/${quotation.id}/print?generated=1`;
      else{setMessage("Draft saved.");setTimeout(()=>location.reload(),450);}
    }catch(e){setMessage(e instanceof Error?e.message:"Unable to save quotation.");setSavingAction(null);}
  }

  return <>
    <div className="adminPanel"><div className="quotationStatusBar"><div><span className={`workflowBadge ${quotation.status}`}>{String(quotation.status).replaceAll("_"," ").toUpperCase()}</span><p className="formNote">Customer-request wording and supplier information are preserved internally. Supplier costs never appear on the customer document.</p></div><span>Valid to {quotation.valid_until||"—"}</span></div></div>
    <div className="adminPanel pricingWorkspaceV54"><div className="panelHeading"><div><h2>Requirement & Pricing Workspace</h2><p>Match owned items, add outside rentals, and keep the original customer wording next to the final quotation description.</p></div></div><QuotationLineEditor rows={rows} onChange={setRows} cameras={cameras} accessories={accessories} kits={kits} rates={rates} defaultRentalDays={defaultRentalDays}/></div>
    <div className="quoteBottomGrid"><div className="adminPanel formPanel"><h2>Notes</h2><label>Customer-facing notes<textarea rows={5} value={customerNotes} onChange={e=>setCustomerNotes(e.target.value)}/></label><label>Internal notes<textarea rows={5} value={internalNotes} onChange={e=>setInternalNotes(e.target.value)}/></label></div><div className="adminPanel quoteTotalsPanel"><h2>Totals</h2><div><span>Subtotal</span><b>{money(subtotal)}</b></div><label><span>Overall discount</span><input type="number" min="0" value={discount} onChange={e=>setDiscount(Number(e.target.value))}/></label><label><span>Tax</span><input type="number" min="0" value={tax} onChange={e=>setTax(Number(e.target.value))}/></label><label><span>Other charges</span><input type="number" min="0" value={otherCharges} onChange={e=>setOtherCharges(Number(e.target.value))}/></label><div className="grandTotal"><span>Grand Total</span><b>{money(total)}</b></div><div className="quoteActions"><button className="button ghost" type="button" disabled={saving||quotation.status==="converted"} onClick={()=>void saveWithStatus("draft")}>{savingAction==="draft"?"Saving Draft…":"Save Draft"}</button><button className="button gold" type="button" disabled={saving||quotation.status==="converted"} onClick={()=>void saveWithStatus("generated")}>{savingAction==="generate"?"Generating…":quotation.status==="draft"?"Generate Quotation":"Generate Updated Quotation"}</button></div><a className="button ghost fullWidthButton" href={`/admin/quotations/${quotation.id}/print`}>View Quotation Document</a>{message&&<div className={message.includes("saved")?"successBox":"errorBox"}>{message}</div>}</div></div>
    {saving&&<div className="actionOverlay" role="status" aria-live="polite"><div className="actionOverlayCard"><span className="loadingSpinner"/><b>{savingAction==="generate"?"Generating updated quotation…":"Saving quotation draft…"}</b><small>Saving requirements, source details, supplier costs, and customer pricing.</small></div></div>}
  </>;
}
