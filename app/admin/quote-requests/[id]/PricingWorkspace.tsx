"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
import {QuotationLineEditor,type QuotationRow} from "@/components/QuotationLineEditor";

function daysBetween(start?:string|null,end?:string|null){if(!start||!end)return 1;const a=new Date(start).getTime(),b=new Date(end).getTime();if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)return 1;return Math.max(1,Math.ceil((b-a)/86400000));}
const money=(n:number)=>`₹${Number(n||0).toLocaleString("en-IN")}`;
function fmtDate(v?:string|null){return v?new Date(v).toLocaleString("en-IN"):"Not set";}

export function PricingWorkspace({request,cameras,accessories,kits,rates,supplierItems,existingQuotes}:any){
  const supabase=createClient();
  const rentalDays=daysBetween(request.start_at,request.end_at);

  const initialRows:QuotationRow[]=useMemo(()=>[],[]);
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
  const subtotal=rows.reduce((n,r)=>n+(r.quantity||0)*(r.rental_days||0)*(r.quoted_rate_inr||0),0);
  const total=Math.max(0,subtotal-discount+tax+otherCharges);

  useEffect(()=>{const warning=sessionStorage.getItem("quoteRequestUploadWarning");if(warning){setMessage(warning);sessionStorage.removeItem("quoteRequestUploadWarning");}},[]);

  function rpcItems(){return rows.map((r,i)=>({...r,item_id:r.item_id||"",request_item_id:r.request_item_id||"",catalog_item_id:r.catalog_item_id||"",supplier_id:r.supplier_id||"",supplier_catalog_item_id:r.supplier_catalog_item_id||"",sort_order:i}));}

  async function saveQuotation(status:"draft"|"generated"){
    setSavingAction(status==="generated"?"generate":"draft");setMessage("");
    try{
      const validUntil=validDays>0?new Date(Date.now()+validDays*86400000).toISOString().slice(0,10):null;
      const {data,error}=await supabase.rpc("create_quotation_atomic",{p_quote_request_id:request.id,p_status:status,p_valid_until:validUntil,p_discount_inr:discount,p_tax_inr:tax,p_other_charges_inr:otherCharges,p_customer_notes:customerNotes||null,p_internal_notes:internalNotes||null,p_items:rpcItems()});
      if(error)throw error;
      const result=data as {quotation_id:string};
      location.href=status==="generated"?`/admin/quotations/${result.quotation_id}/print?generated=1`:`/admin/quotations/${result.quotation_id}`;
    }catch(e){setMessage(e instanceof Error?e.message:"Unable to save quotation.");setSavingAction(null);}
  }

  return <>
    <div className="quoteRequestSummary adminPanel v6CompactSummary">
      <div><span>Production / Customer</span><b>{request.company_name||request.name||"Not entered"}</b></div>
      <div><span>Contact</span><b>{[request.name,request.phone].filter(Boolean).join(" · ")||"Not entered"}</b></div>
      <div><span>Rental</span><b>{fmtDate(request.start_at)} → {fmtDate(request.end_at)}</b></div>
      <div><span>Notes</span><b>{request.notes||"—"}</b></div>
    </div>

    {existingQuotes.length>0&&<div className="existingQuoteRibbon"><span>Existing:</span>{existingQuotes.map((q:any)=><Link href={`/admin/quotations/${q.id}`} key={q.id}>{q.quotation_code} · {money(q.total_inr)}</Link>)}</div>}

    <div className="v6WorkspaceHeading"><div><div className="eyebrow">V6 QUOTATION BUILDER</div><h2>Build the package without leaving the screen</h2><p>Search on the left. Every item you add goes to the current quotation on the right.</p></div></div>

    <QuotationLineEditor rows={rows} onChange={setRows} cameras={cameras} accessories={accessories} kits={kits} rates={rates} supplierItems={supplierItems} defaultRentalDays={rentalDays} discount={discount} tax={tax} otherCharges={otherCharges} onDiscount={setDiscount} onTax={setTax} onOtherCharges={setOtherCharges}/>

    <div className="v6QuoteFooterBar">
      <details className="quoteOptionalDetails"><summary>Optional details</summary><div className="optionalDetailsGrid"><label>Validity (days)<input type="number" min="0" value={validDays} onChange={e=>setValidDays(Number(e.target.value))}/></label><label>Customer note<textarea rows={3} value={customerNotes} onChange={e=>setCustomerNotes(e.target.value)} placeholder="Optional terms or note"/></label><label>Internal note<textarea rows={3} value={internalNotes} onChange={e=>setInternalNotes(e.target.value)} placeholder="Never shown to customer"/></label></div></details>
      <div className="v6FooterActions"><div><span>Grand Total</span><b>{money(total)}</b></div><button type="button" className="button ghost" disabled={saving} onClick={()=>void saveQuotation("draft")}>{savingAction==="draft"?"Saving…":"Save Draft"}</button><button type="button" className="button gold" disabled={saving} onClick={()=>void saveQuotation("generated")}>{savingAction==="generate"?"Generating…":"Generate Quotation"}</button></div>
    </div>
    {message&&<div className="errorBox">{message}</div>}
    {saving&&<div className="actionOverlay" role="status" aria-live="polite"><div className="actionOverlayCard"><span className="loadingSpinner"/><b>{savingAction==="generate"?"Generating quotation…":"Saving draft…"}</b><small>No fields are mandatory at draft stage. You can complete missing information later.</small></div></div>}
  </>;
}
