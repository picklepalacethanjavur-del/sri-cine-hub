"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Row = {
  key:string;
  item_type:"camera"|"accessory"|"kit"|"service"|"other";
  item_id:string|null;
  description:string;
  quantity:number;
  rental_days:number;
  internal_rate_inr:number;
  quoted_rate_inr:number;
  notes:string;
};

function daysBetween(start:string,end:string){
  return Math.max(1,Math.ceil((new Date(end).getTime()-new Date(start).getTime())/86400000));
}
function money(n:number){return `₹${Number(n||0).toLocaleString("en-IN")}`;}

export function PricingWorkspace({request,cameras,accessories,kits,rates,existingQuotes,userId}:any){
  const supabase=createClient();
  const rentalDays=daysBetween(request.start_at,request.end_at);

  const initialRows:Row[]=useMemo(()=>{
    const rows:Row[]=[];
    for(const id of request.requested_camera_ids||[]){
      const c=cameras.find((x:any)=>x.id===id);
      const rate=rates.find((x:any)=>x.camera_id===id);
      if(c) rows.push({
        key:`camera:${id}`, item_type:"camera", item_id:id,
        description:`${c.camera_code} · ${c.name}`, quantity:1, rental_days:rentalDays,
        internal_rate_inr:Number(rate?.daily_rate_inr||0),
        quoted_rate_inr:Number(rate?.daily_rate_inr||0), notes:""
      });
    }
    for(const id of request.requested_accessory_ids||[]){
      const a=accessories.find((x:any)=>x.id===id);
      const rate=rates.find((x:any)=>x.accessory_id===id);
      if(a) rows.push({
        key:`accessory:${id}`, item_type:"accessory", item_id:id,
        description:`${a.accessory_code} · ${a.name}`, quantity:1, rental_days:rentalDays,
        internal_rate_inr:Number(rate?.daily_rate_inr||0),
        quoted_rate_inr:Number(rate?.daily_rate_inr||0), notes:""
      });
    }
    return rows;
  },[request,cameras,accessories,rates,rentalDays]);

  const [rows,setRows]=useState<Row[]>(initialRows);
  const [discount,setDiscount]=useState(0);
  const [tax,setTax]=useState(0);
  const [otherCharges,setOtherCharges]=useState(0);
  const [customerNotes,setCustomerNotes]=useState("");
  const [internalNotes,setInternalNotes]=useState("");
  const [validDays,setValidDays]=useState(7);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  const subtotal=rows.reduce((n:number,r:Row)=>n+(r.quantity*r.rental_days*r.quoted_rate_inr),0);
  const total=Math.max(0,subtotal-discount+tax+otherCharges);

  function patch(key:string,values:Partial<Row>){
    setRows(old=>old.map(r=>r.key===key?{...r,...values}:r));
  }
  function remove(key:string){setRows(old=>old.filter(r=>r.key!==key));}
  function addAsset(type:"camera"|"accessory"|"kit",id:string){
    if(!id) return;
    if(rows.some(r=>r.item_type===type&&r.item_id===id)) return;
    if(type==="camera"){
      const c=cameras.find((x:any)=>x.id===id); const rate=rates.find((x:any)=>x.camera_id===id);
      if(c)setRows(old=>[...old,{key:`camera:${id}:${Date.now()}`,item_type:"camera",item_id:id,description:`${c.camera_code} · ${c.name}`,quantity:1,rental_days:rentalDays,internal_rate_inr:Number(rate?.daily_rate_inr||0),quoted_rate_inr:Number(rate?.daily_rate_inr||0),notes:""}]);
    } else if(type==="accessory"){
      const a=accessories.find((x:any)=>x.id===id); const rate=rates.find((x:any)=>x.accessory_id===id);
      if(a)setRows(old=>[...old,{key:`accessory:${id}:${Date.now()}`,item_type:"accessory",item_id:id,description:`${a.accessory_code} · ${a.name}`,quantity:1,rental_days:rentalDays,internal_rate_inr:Number(rate?.daily_rate_inr||0),quoted_rate_inr:Number(rate?.daily_rate_inr||0),notes:""}]);
    } else {
      const k=kits.find((x:any)=>x.id===id);
      if(k)setRows(old=>[...old,{key:`kit:${id}:${Date.now()}`,item_type:"kit",item_id:id,description:`${k.kit_code} · ${k.name}`,quantity:1,rental_days:rentalDays,internal_rate_inr:Number(k.internal_daily_rate_inr||0),quoted_rate_inr:Number(k.internal_daily_rate_inr||0),notes:""}]);
    }
  }
  function addCustom(){
    setRows(old=>[...old,{key:`other:${Date.now()}`,item_type:"other",item_id:null,description:"Custom charge",quantity:1,rental_days:1,internal_rate_inr:0,quoted_rate_inr:0,notes:""}]);
  }

  function rpcItems(){
    return rows.map((r,i)=>({
      item_type:r.item_type,
      item_id:r.item_id,
      description:r.description,
      quantity:r.quantity,
      rental_days:r.rental_days,
      quoted_rate_inr:r.quoted_rate_inr,
      internal_rate_inr:r.internal_rate_inr,
      notes:r.notes,
      sort_order:i
    }));
  }

  async function saveQuotation(status:"draft"|"sent"){
    if(!rows.length){setMessage("Add at least one quotation item.");return;}
    setSaving(true);setMessage("");
    try{
      const validUntil=new Date(Date.now()+validDays*86400000).toISOString().slice(0,10);
      const {data,error}=await supabase.rpc("create_quotation_atomic",{
        p_quote_request_id:request.id,
        p_status:status,
        p_valid_until:validUntil,
        p_discount_inr:discount,
        p_tax_inr:tax,
        p_other_charges_inr:otherCharges,
        p_customer_notes:customerNotes,
        p_internal_notes:internalNotes,
        p_items:rpcItems()
      });
      if(error) throw error;
      const result=data as {quotation_id:string};
      location.href=`/admin/quotations/${result.quotation_id}`;
    }catch(e){
      setMessage(e instanceof Error?e.message:"Unable to save quotation.");
      setSaving(false);
    }
  }

  return <>
    <div className="quoteRequestSummary adminPanel">
      <div><span>Customer</span><b>{request.company_name||request.name}</b></div>
      <div><span>Contact</span><b>{request.name} · {request.phone}</b></div>
      <div><span>Rental</span><b>{new Date(request.start_at).toLocaleString("en-IN")} → {new Date(request.end_at).toLocaleString("en-IN")}</b></div>
      <div><span>Requested notes</span><b>{request.notes||"—"}</b></div>
    </div>

    {existingQuotes.length>0&&<div className="adminPanel">
      <h2>Existing quotations for this request</h2>
      {existingQuotes.map((q:any)=><Link href={`/admin/quotations/${q.id}`} className="clickableQuoteRow" key={q.id}>
        <div><b>{q.quotation_code}</b><span>{q.status}</span></div><strong>{money(q.total_inr)}</strong>
      </Link>)}
    </div>}

    <div className="adminPanel">
      <div className="panelHeading"><div><h2>Pricing Workspace</h2><p>Internal rate is reference-only. Edit Quote Rate per line.</p></div></div>

      <div className="quoteEditorTableWrap">
        <table className="quoteEditorTable">
          <thead><tr><th>Item</th><th>Qty</th><th>Days</th><th>Internal Rate</th><th>Quote Rate</th><th>Amount</th><th></th></tr></thead>
          <tbody>
          {rows.map(r=><tr key={r.key}>
            <td><input className="lineDescription" value={r.description} onChange={e=>patch(r.key,{description:e.target.value})}/><input className="lineNote" placeholder="Line note (optional)" value={r.notes} onChange={e=>patch(r.key,{notes:e.target.value})}/></td>
            <td><input type="number" min="0.01" step="0.01" value={r.quantity} onChange={e=>patch(r.key,{quantity:Number(e.target.value)})}/></td>
            <td><input type="number" min="0.01" step="0.5" value={r.rental_days} onChange={e=>patch(r.key,{rental_days:Number(e.target.value)})}/></td>
            <td className="internalRate">{money(r.internal_rate_inr)}</td>
            <td><input className="priceInput" type="number" min="0" step="1" value={r.quoted_rate_inr} onChange={e=>patch(r.key,{quoted_rate_inr:Number(e.target.value)})}/></td>
            <td><b>{money(r.quantity*r.rental_days*r.quoted_rate_inr)}</b></td>
            <td><button type="button" className="iconButton danger" onClick={()=>remove(r.key)}>×</button></td>
          </tr>)}
          </tbody>
        </table>
      </div>

      <div className="addItemBar">
        <select defaultValue="" onChange={e=>{addAsset("camera",e.target.value);e.currentTarget.value=""}}><option value="">+ Add camera</option>{cameras.map((x:any)=><option value={x.id} key={x.id}>{x.camera_code} · {x.name}</option>)}</select>
        <select defaultValue="" onChange={e=>{addAsset("accessory",e.target.value);e.currentTarget.value=""}}><option value="">+ Add accessory</option>{accessories.map((x:any)=><option value={x.id} key={x.id}>{x.accessory_code} · {x.name}</option>)}</select>
        <select defaultValue="" onChange={e=>{addAsset("kit",e.target.value);e.currentTarget.value=""}}><option value="">+ Add kit</option>{kits.map((x:any)=><option value={x.id} key={x.id}>{x.kit_code} · {x.name}</option>)}</select>
        <button type="button" className="button ghost" onClick={addCustom}>+ Custom charge</button>
      </div>
    </div>

    <div className="quoteBottomGrid">
      <div className="adminPanel formPanel">
        <h2>Quotation settings</h2>
        <label>Valid for (days)<input type="number" min="1" value={validDays} onChange={e=>setValidDays(Number(e.target.value))}/></label>
        <label>Customer-facing notes<textarea rows={4} value={customerNotes} onChange={e=>setCustomerNotes(e.target.value)} placeholder="Terms, pickup/return notes, exclusions…"/></label>
        <label>Internal notes<textarea rows={4} value={internalNotes} onChange={e=>setInternalNotes(e.target.value)} placeholder="Not shown on customer quotation"/></label>
      </div>

      <div className="adminPanel quoteTotalsPanel">
        <h2>Totals</h2>
        <div><span>Equipment / service subtotal</span><b>{money(subtotal)}</b></div>
        <label><span>Overall discount</span><input type="number" value={discount} onChange={e=>setDiscount(Number(e.target.value))}/></label>
        <label><span>Tax</span><input type="number" value={tax} onChange={e=>setTax(Number(e.target.value))}/></label>
        <label><span>Other charges</span><input type="number" value={otherCharges} onChange={e=>setOtherCharges(Number(e.target.value))}/></label>
        <div className="grandTotal"><span>Grand Total</span><b>{money(total)}</b></div>
        <div className="quoteActions">
          <button type="button" className="button ghost" disabled={saving} onClick={()=>saveQuotation("draft")}>Save Draft</button>
          <button type="button" className="button gold" disabled={saving} onClick={()=>saveQuotation("sent")}>{saving?"Saving…":"Generate Quotation"}</button>
        </div>
        {message&&<div className="errorBox">{message}</div>}
      </div>
    </div>
  </>;
}
