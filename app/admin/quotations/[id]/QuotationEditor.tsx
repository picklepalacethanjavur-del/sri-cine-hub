"use client";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Row={id?:string;key:string;item_type:string;item_id:string|null;description:string;quantity:number;rental_days:number;internal_rate_inr:number;quoted_rate_inr:number;notes:string};
const money=(n:number)=>`₹${Number(n||0).toLocaleString("en-IN")}`;

export function QuotationEditor({quotation,items,request,cameras,accessories,kits,rates}:any){
  const supabase=createClient();
  const [rows,setRows]=useState<Row[]>(items.map((x:any)=>({id:x.id,key:x.id,item_type:x.item_type,item_id:x.item_id,description:x.description,quantity:Number(x.quantity),rental_days:Number(x.rental_days),internal_rate_inr:Number(x.internal_rate_inr||0),quoted_rate_inr:Number(x.unit_rate_inr||0),notes:x.notes||""})));
  const [discount,setDiscount]=useState(Number(quotation.discount_inr||0));
  const [tax,setTax]=useState(Number(quotation.tax_inr||0));
  const [otherCharges,setOtherCharges]=useState(Number(quotation.other_charges_inr||0));
  const [customerNotes,setCustomerNotes]=useState(quotation.customer_notes||"");
  const [internalNotes,setInternalNotes]=useState(quotation.internal_notes||"");
  const [status,setStatus]=useState(quotation.status);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  const subtotal=rows.reduce((n:number,r:Row)=>n+r.quantity*r.rental_days*r.quoted_rate_inr,0);
  const total=Math.max(0,subtotal-discount+tax+otherCharges);

  function patch(key:string,v:Partial<Row>){setRows(old=>old.map(r=>r.key===key?{...r,...v}:r));}
  function remove(key:string){setRows(old=>old.filter(r=>r.key!==key));}
  function addCustom(){setRows(old=>[...old,{key:`new:${Date.now()}`,item_type:"other",item_id:null,description:"Custom charge",quantity:1,rental_days:1,internal_rate_inr:0,quoted_rate_inr:0,notes:""}]);}
  function addAsset(type:string,id:string){
    if(!id)return;
    if(type==="camera"){const c=cameras.find((x:any)=>x.id===id);const rt=rates.find((x:any)=>x.camera_id===id);if(c)setRows(old=>[...old,{key:`new:${Date.now()}`,item_type:"camera",item_id:id,description:`${c.camera_code} · ${c.name}`,quantity:1,rental_days:1,internal_rate_inr:Number(rt?.daily_rate_inr||0),quoted_rate_inr:Number(rt?.daily_rate_inr||0),notes:""}]);}
    if(type==="accessory"){const a=accessories.find((x:any)=>x.id===id);const rt=rates.find((x:any)=>x.accessory_id===id);if(a)setRows(old=>[...old,{key:`new:${Date.now()}`,item_type:"accessory",item_id:id,description:`${a.accessory_code} · ${a.name}`,quantity:1,rental_days:1,internal_rate_inr:Number(rt?.daily_rate_inr||0),quoted_rate_inr:Number(rt?.daily_rate_inr||0),notes:""}]);}
    if(type==="kit"){const k=kits.find((x:any)=>x.id===id);if(k)setRows(old=>[...old,{key:`new:${Date.now()}`,item_type:"kit",item_id:id,description:`${k.kit_code} · ${k.name}`,quantity:1,rental_days:1,internal_rate_inr:Number(k.internal_daily_rate_inr||0),quoted_rate_inr:Number(k.internal_daily_rate_inr||0),notes:""}]);}
  }

  async function save(){
    setSaving(true);setMessage("");
    try{
      const up=await supabase.from("quotations").update({
        status,subtotal_inr:subtotal,discount_inr:discount,tax_inr:tax,other_charges_inr:otherCharges,
        customer_notes:customerNotes,internal_notes:internalNotes
      }).eq("id",quotation.id);
      if(up.error) throw up.error;

      const del=await supabase.from("quotation_items").delete().eq("quotation_id",quotation.id);
      if(del.error) throw del.error;
      const ins=await supabase.from("quotation_items").insert(rows.map((r,i)=>({
        quotation_id:quotation.id,item_type:r.item_type,item_id:r.item_id,description:r.description,
        quantity:r.quantity,rental_days:r.rental_days,unit_rate_inr:r.quoted_rate_inr,
        internal_rate_inr:r.internal_rate_inr,notes:r.notes,sort_order:i
      })));
      if(ins.error) throw ins.error;
      setMessage("Quotation saved.");
      setTimeout(()=>location.reload(),500);
    }catch(e){setMessage(e instanceof Error?e.message:"Unable to save.");setSaving(false);}
  }

  async function convertToBooking(){
    if(!request){setMessage("This quotation has no linked quote request.");return;}
    if(!["accepted","sent"].includes(status)){setMessage("Mark the quotation Accepted before converting to a booking.");return;}
    setSaving(true);setMessage("");
    try{
      const code=`BK-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const cameraCharge=rows.filter(r=>r.item_type==="camera").reduce((n,r)=>n+r.quantity*r.rental_days*r.quoted_rate_inr,0);
      const accessoryCharge=rows.filter(r=>r.item_type==="accessory").reduce((n,r)=>n+r.quantity*r.rental_days*r.quoted_rate_inr,0);
      const misc=rows.filter(r=>!["camera","accessory"].includes(r.item_type)).reduce((n,r)=>n+r.quantity*r.rental_days*r.quoted_rate_inr,0)+tax+otherCharges;

      const {data:b,error}=await supabase.from("bookings").insert({
        booking_code:code,customer_id:quotation.customer_id,status:"reserved",
        project_name:request.project_name,production_name:request.company_name,
        contact_name:request.name,contact_phone:request.phone,start_at:request.start_at,end_at:request.end_at,
        camera_charge_inr:cameraCharge,accessories_charge_inr:accessoryCharge,other_charges_inr:misc,
        discount_inr:discount,notes:customerNotes
      }).select("id").single();
      if(error) throw error;

      const camRows=rows.filter(r=>r.item_type==="camera"&&r.item_id).map(r=>({booking_id:b.id,camera_id:r.item_id,daily_rate_inr:r.quoted_rate_inr}));
      if(camRows.length){const x=await supabase.from("booking_cameras").insert(camRows);if(x.error)throw x.error;}
      const accRows=rows.filter(r=>r.item_type==="accessory"&&r.item_id).map(r=>({booking_id:b.id,accessory_id:r.item_id,quantity:Math.max(1,Math.round(r.quantity)),daily_rate_inr:r.quoted_rate_inr}));
      if(accRows.length){const x=await supabase.from("booking_accessories").insert(accRows);if(x.error)throw x.error;}

      await supabase.from("quotations").update({status:"converted"}).eq("id",quotation.id);
      await supabase.from("quote_requests").update({status:"converted",converted_booking_id:b.id}).eq("id",request.id);
      location.href="/admin/bookings";
    }catch(e){setMessage(e instanceof Error?e.message:"Unable to convert.");setSaving(false);}
  }

  return <>
    <div className="adminPanel">
      <div className="quotationStatusBar">
        <label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="draft">Draft</option><option value="sent">Sent</option><option value="accepted">Accepted</option><option value="declined">Declined</option><option value="expired">Expired</option><option value="converted">Converted</option></select></label>
        <span>Valid to {quotation.valid_until||"—"}</span>
      </div>
    </div>

    <div className="adminPanel">
      <h2>Line-item pricing</h2>
      <p className="formNote">Internal rate is historical reference. Quote Rate is what the customer pays.</p>
      <div className="quoteEditorTableWrap">
        <table className="quoteEditorTable">
          <thead><tr><th>Item</th><th>Qty</th><th>Days</th><th>Internal Rate</th><th>Quote Rate</th><th>Amount</th><th></th></tr></thead>
          <tbody>{rows.map(r=><tr key={r.key}>
            <td><input className="lineDescription" value={r.description} onChange={e=>patch(r.key,{description:e.target.value})}/><input className="lineNote" value={r.notes} placeholder="Line note" onChange={e=>patch(r.key,{notes:e.target.value})}/></td>
            <td><input type="number" min=".01" step=".01" value={r.quantity} onChange={e=>patch(r.key,{quantity:Number(e.target.value)})}/></td>
            <td><input type="number" min=".01" step=".5" value={r.rental_days} onChange={e=>patch(r.key,{rental_days:Number(e.target.value)})}/></td>
            <td className="internalRate">{money(r.internal_rate_inr)}</td>
            <td><input className="priceInput" type="number" min="0" value={r.quoted_rate_inr} onChange={e=>patch(r.key,{quoted_rate_inr:Number(e.target.value)})}/></td>
            <td><b>{money(r.quantity*r.rental_days*r.quoted_rate_inr)}</b></td>
            <td><button className="iconButton danger" type="button" onClick={()=>remove(r.key)}>×</button></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="addItemBar">
        <select defaultValue="" onChange={e=>{addAsset("camera",e.target.value);e.currentTarget.value=""}}><option value="">+ Add camera</option>{cameras.map((x:any)=><option value={x.id} key={x.id}>{x.camera_code} · {x.name}</option>)}</select>
        <select defaultValue="" onChange={e=>{addAsset("accessory",e.target.value);e.currentTarget.value=""}}><option value="">+ Add accessory</option>{accessories.map((x:any)=><option value={x.id} key={x.id}>{x.accessory_code} · {x.name}</option>)}</select>
        <select defaultValue="" onChange={e=>{addAsset("kit",e.target.value);e.currentTarget.value=""}}><option value="">+ Add kit</option>{kits.map((x:any)=><option value={x.id} key={x.id}>{x.kit_code} · {x.name}</option>)}</select>
        <button className="button ghost" type="button" onClick={addCustom}>+ Custom charge</button>
      </div>
    </div>

    <div className="quoteBottomGrid">
      <div className="adminPanel formPanel">
        <h2>Notes</h2>
        <label>Customer-facing notes<textarea rows={5} value={customerNotes} onChange={e=>setCustomerNotes(e.target.value)}/></label>
        <label>Internal notes<textarea rows={5} value={internalNotes} onChange={e=>setInternalNotes(e.target.value)}/></label>
      </div>
      <div className="adminPanel quoteTotalsPanel">
        <h2>Totals</h2>
        <div><span>Subtotal</span><b>{money(subtotal)}</b></div>
        <label><span>Overall discount</span><input type="number" value={discount} onChange={e=>setDiscount(Number(e.target.value))}/></label>
        <label><span>Tax</span><input type="number" value={tax} onChange={e=>setTax(Number(e.target.value))}/></label>
        <label><span>Other charges</span><input type="number" value={otherCharges} onChange={e=>setOtherCharges(Number(e.target.value))}/></label>
        <div className="grandTotal"><span>Grand Total</span><b>{money(total)}</b></div>
        <div className="quoteActions">
          <button className="button ghost" type="button" disabled={saving} onClick={save}>Save Changes</button>
          <button className="button gold" type="button" disabled={saving||status==="converted"} onClick={convertToBooking}>Convert to Booking</button>
        </div>
        {message&&<div className={message.includes("saved")?"successBox":"errorBox"}>{message}</div>}
      </div>
    </div>
  </>;
}
