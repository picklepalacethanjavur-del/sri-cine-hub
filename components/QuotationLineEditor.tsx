"use client";

export type SourceType = "own" | "sub_rental" | "manual" | "service";
export type SupplierRateType = "daily" | "weekly" | "flat";
export type SupplierStatus = "not_required" | "not_checked" | "requested" | "confirmed" | "received" | "returned" | "cancelled";

export type QuotationRow = {
  key:string;
  item_type:"camera"|"accessory"|"kit"|"service"|"other";
  item_id:string|null;
  section_name:string;
  requested_description:string;
  description:string;
  source_type:SourceType;
  quantity:number;
  rental_days:number;
  internal_rate_inr:number;
  quoted_rate_inr:number;
  supplier_name:string;
  supplier_cost_inr:number;
  supplier_rate_type:SupplierRateType;
  supplier_status:SupplierStatus;
  supplier_reference:string;
  notes:string;
};

const SECTION_PRESETS=["Camera","Lenses","Accessories & Attachments","Lights","Grip & Movement","Audio","Transport","Gensets","Crew","Post Production","Other"];

function money(n:number){return `₹${Number(n||0).toLocaleString("en-IN")}`;}
function lineAmount(r:QuotationRow){return Math.max(0,r.quantity)*Math.max(0,r.rental_days)*Math.max(0,r.quoted_rate_inr);}
function supplierTotal(r:QuotationRow){
  const cost=Math.max(0,r.supplier_cost_inr||0);
  if(r.supplier_rate_type==="flat") return cost;
  if(r.supplier_rate_type==="weekly") return Math.max(0,r.quantity)*Math.ceil(Math.max(1,r.rental_days)/7)*cost;
  return Math.max(0,r.quantity)*Math.max(0,r.rental_days)*cost;
}

export function QuotationLineEditor({
  rows,onChange,cameras,accessories,kits,rates,defaultRentalDays
}:{
  rows:QuotationRow[];
  onChange:(rows:QuotationRow[])=>void;
  cameras:any[];
  accessories:any[];
  kits:any[];
  rates:any[];
  defaultRentalDays:number;
}){
  function patch(key:string,values:Partial<QuotationRow>){onChange(rows.map(r=>r.key===key?{...r,...values}:r));}
  function remove(key:string){onChange(rows.filter(r=>r.key!==key));}
  function add(row:QuotationRow){onChange([...rows,row]);}

  function addAsset(type:"camera"|"accessory"|"kit",id:string){
    if(!id)return;
    if(type==="camera"){
      const c=cameras.find((x:any)=>x.id===id);const rate=rates.find((x:any)=>x.camera_id===id);
      if(c)add({key:`camera:${id}:${Date.now()}`,item_type:"camera",item_id:id,section_name:"Camera",requested_description:c.name,description:c.name,source_type:"own",quantity:1,rental_days:defaultRentalDays,internal_rate_inr:Number(rate?.daily_rate_inr||0),quoted_rate_inr:Number(rate?.daily_rate_inr||0),supplier_name:"",supplier_cost_inr:0,supplier_rate_type:"daily",supplier_status:"not_required",supplier_reference:"",notes:""});
    }else if(type==="accessory"){
      const a=accessories.find((x:any)=>x.id===id);const rate=rates.find((x:any)=>x.accessory_id===id);
      const raw=String(a?.category||"").toLowerCase();
      const section=raw.includes("lens")?"Lenses":raw.includes("light")?"Lights":raw.includes("audio")?"Audio":raw.includes("grip")||raw.includes("board")||raw.includes("gimbal")?"Grip & Movement":raw.includes("transport")?"Transport":raw.includes("generator")?"Gensets":"Accessories & Attachments";
      if(a)add({key:`accessory:${id}:${Date.now()}`,item_type:"accessory",item_id:id,section_name:section,requested_description:a.name,description:a.name,source_type:"own",quantity:1,rental_days:defaultRentalDays,internal_rate_inr:Number(rate?.daily_rate_inr||0),quoted_rate_inr:Number(rate?.daily_rate_inr||0),supplier_name:"",supplier_cost_inr:0,supplier_rate_type:"daily",supplier_status:"not_required",supplier_reference:"",notes:""});
    }else{
      const k=kits.find((x:any)=>x.id===id);
      if(k)add({key:`kit:${id}:${Date.now()}`,item_type:"kit",item_id:id,section_name:"Camera",requested_description:k.name,description:k.name,source_type:"own",quantity:1,rental_days:defaultRentalDays,internal_rate_inr:Number(k.internal_daily_rate_inr||0),quoted_rate_inr:Number(k.internal_daily_rate_inr||0),supplier_name:"",supplier_cost_inr:0,supplier_rate_type:"daily",supplier_status:"not_required",supplier_reference:"",notes:""});
    }
  }

  function addExternal(source:SourceType){
    const isService=source==="service";
    add({key:`${source}:${Date.now()}`,item_type:isService?"service":"other",item_id:null,section_name:isService?"Crew":"Other",requested_description:"",description:isService?"Service / crew":"Requested item",source_type:source,quantity:1,rental_days:source==="manual"?1:defaultRentalDays,internal_rate_inr:0,quoted_rate_inr:0,supplier_name:"",supplier_cost_inr:0,supplier_rate_type:"daily",supplier_status:source==="sub_rental"?"not_checked":"not_required",supplier_reference:"",notes:""});
  }

  const ownCount=rows.filter(r=>r.source_type==="own").length;
  const sourcingCount=rows.filter(r=>r.source_type==="sub_rental"&&!(["confirmed","received"].includes(r.supplier_status))).length;
  const subCount=rows.filter(r=>r.source_type==="sub_rental").length;
  const manualCount=rows.filter(r=>r.source_type==="manual"||r.source_type==="service").length;

  return <>
    <datalist id="quote-section-presets">{SECTION_PRESETS.map(s=><option value={s} key={s}/>)}</datalist>
    <div className="fulfillmentSummary">
      <div><span>Our inventory</span><b>{ownCount}</b></div>
      <div><span>Sub-rental</span><b>{subCount}</b></div>
      <div className={sourcingCount?"attention":""}><span>Need sourcing</span><b>{sourcingCount}</b></div>
      <div><span>Manual / Service</span><b>{manualCount}</b></div>
    </div>

    <div className="quotationLineStack">
      {rows.length===0&&<div className="emptyLineState"><b>No requirement lines yet.</b><span>Add Sri Cine Hub inventory, a sub-rental item, a manual item, or a service.</span></div>}
      {rows.map((r,index)=>{
        const amount=lineAmount(r);
        const externalCost=supplierTotal(r);
        const margin=amount-externalCost;
        return <article className={`quotationLineCard source-${r.source_type}`} key={r.key}>
          <div className="quotationLineTop">
            <div className="lineOrder">{index+1}</div>
            <label className="sectionField">Section<input list="quote-section-presets" value={r.section_name} onChange={e=>patch(r.key,{section_name:e.target.value})}/></label>
            <label className="sourceField">Fulfillment<select value={r.source_type} onChange={e=>{
              const next=e.target.value as SourceType;
              patch(r.key,{source_type:next,supplier_status:next==="sub_rental"?(r.supplier_status==="not_required"?"not_checked":r.supplier_status):"not_required"});
            }}><option value="own">OWN · Sri Cine Hub</option><option value="sub_rental">SUB-RENTAL</option><option value="manual">MANUAL / OTHER</option><option value="service">SERVICE</option></select></label>
            <span className={`sourceBadge ${r.source_type}`}>{r.source_type==="own"?"OWN":r.source_type==="sub_rental"?"SUB-RENTAL":r.source_type==="service"?"SERVICE":"MANUAL"}</span>
            <button type="button" className="iconButton danger" onClick={()=>remove(r.key)} aria-label="Remove line">×</button>
          </div>

          <div className="descriptionGrid">
            <label>Customer requested<input value={r.requested_description} placeholder="Original wording from customer request" onChange={e=>patch(r.key,{requested_description:e.target.value})}/></label>
            <label>Quotation description<input className="lineDescription" value={r.description} onChange={e=>patch(r.key,{description:e.target.value})}/></label>
          </div>

          <div className="lineNumbersGrid">
            <label>Qty<input type="number" min="0.01" step="0.01" value={r.quantity} onChange={e=>patch(r.key,{quantity:Number(e.target.value)})}/></label>
            <label>Days<input type="number" min="0.01" step="0.5" value={r.rental_days} onChange={e=>patch(r.key,{rental_days:Number(e.target.value)})}/></label>
            {r.source_type==="own"&&<div className="readOnlyMetric"><span>Internal rate</span><b>{money(r.internal_rate_inr)}</b><small>{r.item_id?"Inventory linked":"No asset linked"}</small></div>}
            {(r.source_type==="manual"||r.source_type==="service")&&<label>Internal cost (optional)<input type="number" min="0" value={r.internal_rate_inr} onChange={e=>patch(r.key,{internal_rate_inr:Number(e.target.value)})}/></label>}
            <label>Customer rate<input className="priceInput" type="number" min="0" step="1" value={r.quoted_rate_inr} onChange={e=>patch(r.key,{quoted_rate_inr:Number(e.target.value)})}/></label>
            <div className="readOnlyMetric amountMetric"><span>Line amount</span><b>{money(amount)}</b></div>
          </div>

          {r.source_type==="sub_rental"&&<div className="supplierPanel">
            <div className="supplierPanelTitle"><b>External supplier / sub-rental</b><span>Supplier details and cost stay internal.</span></div>
            <div className="supplierGrid">
              <label>Supplier / rental company<input value={r.supplier_name} placeholder="Supplier name" onChange={e=>patch(r.key,{supplier_name:e.target.value})}/></label>
              <label>Supplier cost<input type="number" min="0" value={r.supplier_cost_inr} onChange={e=>patch(r.key,{supplier_cost_inr:Number(e.target.value)})}/></label>
              <label>Cost basis<select value={r.supplier_rate_type} onChange={e=>patch(r.key,{supplier_rate_type:e.target.value as SupplierRateType})}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="flat">Flat total</option></select></label>
              <label>Sourcing status<select value={r.supplier_status} onChange={e=>patch(r.key,{supplier_status:e.target.value as SupplierStatus})}><option value="not_checked">Not checked</option><option value="requested">Requested from supplier</option><option value="confirmed">Confirmed</option><option value="received">Received</option><option value="returned">Returned</option><option value="cancelled">Cancelled</option></select></label>
              <label>Supplier reference<input value={r.supplier_reference} placeholder="Quote / PO / reference" onChange={e=>patch(r.key,{supplier_reference:e.target.value})}/></label>
              <div className="supplierMargin"><span>Supplier total</span><b>{money(externalCost)}</b><span>Gross margin</span><strong className={margin<0?"negative":""}>{money(margin)}</strong></div>
            </div>
          </div>}

          <label className="lineNotes">Internal / line note<input value={r.notes} placeholder="Optional note" onChange={e=>patch(r.key,{notes:e.target.value})}/></label>
        </article>;
      })}
    </div>

    <div className="addRequirementPanel">
      <div className="addOwnAssets">
        <b>+ From Sri Cine Hub inventory</b>
        <select defaultValue="" onChange={e=>{addAsset("camera",e.target.value);e.currentTarget.value=""}}><option value="">Add camera…</option>{cameras.map((x:any)=><option value={x.id} key={x.id}>{x.camera_code} · {x.name}</option>)}</select>
        <select defaultValue="" onChange={e=>{addAsset("accessory",e.target.value);e.currentTarget.value=""}}><option value="">Add accessory…</option>{accessories.map((x:any)=><option value={x.id} key={x.id}>{x.accessory_code} · {x.name}</option>)}</select>
        <select defaultValue="" onChange={e=>{addAsset("kit",e.target.value);e.currentTarget.value=""}}><option value="">Add kit…</option>{kits.map((x:any)=><option value={x.id} key={x.id}>{x.kit_code} · {x.name}</option>)}</select>
      </div>
      <div className="addExternalButtons">
        <button type="button" className="button subRentalButton" onClick={()=>addExternal("sub_rental")}>+ Sub-Rental Item</button>
        <button type="button" className="button ghost" onClick={()=>addExternal("manual")}>+ Manual Item</button>
        <button type="button" className="button ghost" onClick={()=>addExternal("service")}>+ Service / Crew</button>
      </div>
    </div>
  </>;
}
