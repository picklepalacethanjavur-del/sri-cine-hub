"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
import {QuotationLineEditor,type QuotationRow} from "@/components/QuotationLineEditor";

function daysBetween(start:string,end:string){return Math.max(1,Math.ceil((new Date(end).getTime()-new Date(start).getTime())/86400000));}
function money(n:number){return `₹${Number(n||0).toLocaleString("en-IN")}`;}
function sectionForAccessory(category:string|undefined){
  const raw=String(category||"").toLowerCase();
  if(raw.includes("lens"))return "Lenses";
  if(raw.includes("light"))return "Lights";
  if(raw.includes("audio"))return "Audio";
  if(raw.includes("grip")||raw.includes("board")||raw.includes("gimbal"))return "Grip & Movement";
  if(raw.includes("transport"))return "Transport";
  if(raw.includes("generator"))return "Gensets";
  return "Accessories & Attachments";
}

export function PricingWorkspace({request,cameras,accessories,kits,rates,existingQuotes}:any){
  const supabase=createClient();
  const rentalDays=daysBetween(request.start_at,request.end_at);

  const initialRows:QuotationRow[]=useMemo(()=>{
    const result:QuotationRow[]=[];
    for(const id of request.requested_camera_ids||[]){
      const c=cameras.find((x:any)=>x.id===id);const rate=rates.find((x:any)=>x.camera_id===id);
      if(c)result.push({key:`camera:${id}`,item_type:"camera",item_id:id,section_name:"Camera",requested_description:c.name,description:c.name,source_type:"own",quantity:1,rental_days:rentalDays,internal_rate_inr:Number(rate?.daily_rate_inr||0),quoted_rate_inr:Number(rate?.daily_rate_inr||0),supplier_name:"",supplier_cost_inr:0,supplier_rate_type:"daily",supplier_status:"not_required",supplier_reference:"",notes:""});
    }
    for(const id of request.requested_accessory_ids||[]){
      const a=accessories.find((x:any)=>x.id===id);const rate=rates.find((x:any)=>x.accessory_id===id);
      if(a)result.push({key:`accessory:${id}`,item_type:"accessory",item_id:id,section_name:sectionForAccessory(a.category),requested_description:a.name,description:a.name,source_type:"own",quantity:1,rental_days:rentalDays,internal_rate_inr:Number(rate?.daily_rate_inr||0),quoted_rate_inr:Number(rate?.daily_rate_inr||0),supplier_name:"",supplier_cost_inr:0,supplier_rate_type:"daily",supplier_status:"not_required",supplier_reference:"",notes:""});
    }
    for(const id of request.requested_kit_ids||[]){
      const k=kits.find((x:any)=>x.id===id);
      if(k)result.push({key:`kit:${id}`,item_type:"kit",item_id:id,section_name:"Camera",requested_description:k.name,description:k.name,source_type:"own",quantity:1,rental_days:rentalDays,internal_rate_inr:Number(k.internal_daily_rate_inr||0),quoted_rate_inr:Number(k.internal_daily_rate_inr||0),supplier_name:"",supplier_cost_inr:0,supplier_rate_type:"daily",supplier_status:"not_required",supplier_reference:"",notes:""});
    }
    return result;
  },[request,cameras,accessories,kits,rates,rentalDays]);

  const [rows,setRows]=useState<QuotationRow[]>(initialRows);
  const [discount,setDiscount]=useState(0);
  const [tax,setTax]=useState(0);
  const [otherCharges,setOtherCharges]=useState(0);
  const [customerNotes,setCustomerNotes]=useState("");
  const [internalNotes,setInternalNotes]=useState("");
  const [validDays,setValidDays]=useState(7);
  const [savingAction,setSavingAction]=useState<"draft"|"generate"|null>(null);
  const [message,setMessage]=useState("");
  const saving=!!savingAction;
  const subtotal=rows.reduce((n,r)=>n+r.quantity*r.rental_days*r.quoted_rate_inr,0);
  const total=Math.max(0,subtotal-discount+tax+otherCharges);

  useEffect(()=>{
    const warning=sessionStorage.getItem("quoteRequestUploadWarning");
    if(warning){setMessage(warning);sessionStorage.removeItem("quoteRequestUploadWarning");}
  },[]);

  function rpcItems(){return rows.map((r,i)=>({...r,item_id:r.item_id||"",sort_order:i}));}

  async function saveQuotation(status:"draft"|"generated"){
    if(!rows.length){setMessage("Add at least one requirement line before saving the quotation.");return;}
    setSavingAction(status==="generated"?"generate":"draft");setMessage("");
    try{
      const validUntil=new Date(Date.now()+validDays*86400000).toISOString().slice(0,10);
      const {data,error}=await supabase.rpc("create_quotation_atomic",{p_quote_request_id:request.id,p_status:status,p_valid_until:validUntil,p_discount_inr:discount,p_tax_inr:tax,p_other_charges_inr:otherCharges,p_customer_notes:customerNotes,p_internal_notes:internalNotes,p_items:rpcItems()});
      if(error)throw error;
      const result=data as {quotation_id:string};
      location.href=status==="generated"?`/admin/quotations/${result.quotation_id}/print?generated=1`:`/admin/quotations/${result.quotation_id}`;
    }catch(e){setMessage(e instanceof Error?e.message:"Unable to save quotation.");setSavingAction(null);}
  }

  return <>
    <div className="quoteRequestSummary adminPanel">
      <div><span>Customer</span><b>{request.company_name||request.name}</b></div>
      <div><span>Contact</span><b>{request.name} · {request.phone}</b></div>
      <div><span>Rental</span><b>{new Date(request.start_at).toLocaleString("en-IN")} → {new Date(request.end_at).toLocaleString("en-IN")}</b></div>
      <div><span>Requested notes</span><b>{request.notes||"—"}</b></div>
    </div>

    {existingQuotes.length>0&&<div className="adminPanel existingQuotePanel"><div><h2>Existing quotations for this request</h2><p>Open an existing quotation instead of creating a duplicate when you are revising pricing.</p></div>{existingQuotes.map((q:any)=><Link href={`/admin/quotations/${q.id}/print`} className="clickableQuoteRow" key={q.id}><div><b>{q.quotation_code}</b><span>{q.status}</span></div><strong>{money(q.total_inr)}</strong></Link>)}</div>}

    <div className="adminPanel pricingWorkspaceV54">
      <div className="panelHeading"><div><h2>Requirement & Pricing Workspace</h2><p>Transcribe the customer request, then choose how Sri Cine Hub will fulfill each line: own inventory, sub-rental, manual item, or service.</p></div></div>
      <QuotationLineEditor rows={rows} onChange={setRows} cameras={cameras} accessories={accessories} kits={kits} rates={rates} defaultRentalDays={rentalDays}/>
    </div>

    <div className="quoteBottomGrid">
      <div className="adminPanel formPanel"><h2>Quotation settings</h2><label>Valid for (days)<input type="number" min="1" value={validDays} onChange={e=>setValidDays(Number(e.target.value))}/></label><label>Customer-facing notes<textarea rows={4} value={customerNotes} onChange={e=>setCustomerNotes(e.target.value)} placeholder="Terms, pickup/return notes, exclusions…"/></label><label>Internal notes<textarea rows={4} value={internalNotes} onChange={e=>setInternalNotes(e.target.value)} placeholder="Not shown on customer quotation"/></label></div>
      <div className="adminPanel quoteTotalsPanel"><h2>Totals</h2><div><span>Quotation subtotal</span><b>{money(subtotal)}</b></div><label><span>Overall discount</span><input type="number" min="0" value={discount} onChange={e=>setDiscount(Number(e.target.value))}/></label><label><span>Tax</span><input type="number" min="0" value={tax} onChange={e=>setTax(Number(e.target.value))}/></label><label><span>Other charges</span><input type="number" min="0" value={otherCharges} onChange={e=>setOtherCharges(Number(e.target.value))}/></label><div className="grandTotal"><span>Grand Total</span><b>{money(total)}</b></div><div className="quoteActions"><button type="button" className="button ghost" disabled={saving} onClick={()=>void saveQuotation("draft")}>{savingAction==="draft"?"Saving Draft…":"Save Draft"}</button><button type="button" className="button gold" disabled={saving} onClick={()=>void saveQuotation("generated")}>{savingAction==="generate"?"Generating…":"Generate Quotation"}</button></div>{message&&<div className="errorBox">{message}</div>}</div>
    </div>

    {saving&&<div className="actionOverlay" role="status" aria-live="polite"><div className="actionOverlayCard"><span className="loadingSpinner"/><b>{savingAction==="generate"?"Generating quotation…":"Saving draft…"}</b><small>Saving customer requirements, fulfillment sources, supplier costs, and quoted rates.</small></div></div>}
  </>;
}
