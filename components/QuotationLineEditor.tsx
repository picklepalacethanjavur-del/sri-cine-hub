"use client";

import {useMemo,useState} from "react";

export type SourceType="own"|"supplier"|"manual"|"service";
export type RateBasis="hourly"|"daily"|"weekly"|"flat";
export type SupplierStatus="not_required"|"not_checked"|"requested"|"confirmed"|"received"|"returned"|"cancelled";

export type QuotationRow={
  key:string;
  item_type:"camera"|"accessory"|"kit"|"service"|"other";
  item_id:string|null;
  request_item_id:string|null;
  catalog_item_id:string|null;
  supplier_id:string|null;
  supplier_catalog_item_id:string|null;
  section_name:string;
  requested_description:string;
  description:string;
  source_type:SourceType;
  quantity:number;
  rental_days:number;
  internal_rate_inr:number;
  cost_rate_inr:number;
  cost_rate_basis:RateBasis;
  quoted_rate_inr:number;
  supplier_name:string;
  supplier_status:SupplierStatus;
  supplier_reference:string;
  notes:string;
};

const SECTION_PRESETS=["Camera","Lenses","Accessories & Attachments","Lights","Grip & Movement","Audio","Transport","Gensets","Crew","Post Production","Other"];
const CATEGORY_ORDER=["Camera","Lenses","Accessories & Attachments","Lights","Grip & Movement","Audio","Transport","Gensets","Crew","Post Production","Other"];

const money=(n:number)=>`₹${Number(n||0).toLocaleString("en-IN")}`;
const lineAmount=(r:QuotationRow)=>Math.max(0,r.quantity||0)*Math.max(0,r.rental_days||0)*Math.max(0,r.quoted_rate_inr||0);
function costTotal(r:QuotationRow){
  const q=Math.max(0,r.quantity||0),d=Math.max(0,r.rental_days||0),rate=Math.max(0,r.cost_rate_inr||0);
  if(r.cost_rate_basis==="flat")return rate;
  if(r.cost_rate_basis==="weekly")return q*Math.ceil(Math.max(1,d)/7)*rate;
  if(r.cost_rate_basis==="hourly")return q*rate;
  return q*d*rate;
}
function sectionFor(category?:string,type?:string){
  const raw=String(category||"").toLowerCase();
  if(type==="camera"||raw==="camera"||raw.includes("camera"))return "Camera";
  if(raw.includes("lens"))return "Lenses";
  if(raw.includes("light")||raw.includes("aputure"))return "Lights";
  if(raw.includes("audio")||raw.includes("mic"))return "Audio";
  if(raw.includes("grip")||raw.includes("board")||raw.includes("gimbal")||raw.includes("movement"))return "Grip & Movement";
  if(raw.includes("transport"))return "Transport";
  if(raw.includes("generator")||raw.includes("genset"))return "Gensets";
  if(raw.includes("post"))return "Post Production";
  return "Accessories & Attachments";
}

type InventoryCandidate={key:string;item_type:"camera"|"accessory"|"kit";catalog_item_id:string|null;item_id:string|null;name:string;category:string;available:number;internalRate:number;subtitle:string};
type SupplierCandidate={id:string;supplier_id:string;catalog_item_id:string|null;supplier_item_name:string;category:string;quantity_available:number;default_cost_inr:number;rate_basis:RateBasis;location:string|null;suppliers?:{company_name?:string|null}|null};

export function QuotationLineEditor({
  rows,onChange,cameras,accessories,kits,rates,supplierItems,defaultRentalDays,discount,tax,otherCharges,onDiscount,onTax,onOtherCharges
}:{
  rows:QuotationRow[];onChange:(rows:QuotationRow[])=>void;cameras:any[];accessories:any[];kits:any[];rates:any[];supplierItems:SupplierCandidate[];defaultRentalDays:number;
  discount:number;tax:number;otherCharges:number;onDiscount:(n:number)=>void;onTax:(n:number)=>void;onOtherCharges:(n:number)=>void;
}){
  const [tab,setTab]=useState<"inventory"|"supplier"|"manual">("inventory");
  const [search,setSearch]=useState("");
  const [category,setCategory]=useState("All");
  const [expanded,setExpanded]=useState<string|null>(null);

  function latestCameraRate(id:string){return Number(rates.find((r:any)=>r.camera_id===id)?.daily_rate_inr||0);}
  function latestAccessoryRate(id:string){return Number(rates.find((r:any)=>r.accessory_id===id)?.daily_rate_inr||0);}

  const inventory=useMemo<InventoryCandidate[]>(()=>{
    const map=new Map<string,InventoryCandidate>();
    for(const c of cameras){
      const key=`camera:${c.catalog_item_id||String(c.name).toLowerCase()}`;
      const existing=map.get(key);
      if(existing){existing.available+=1;continue;}
      map.set(key,{key,item_type:"camera",catalog_item_id:c.catalog_item_id||null,item_id:c.catalog_item_id?null:c.id,name:c.name,category:"Camera",available:1,internalRate:latestCameraRate(c.id),subtitle:c.manufacturer||c.model||"Sri Cine Hub"});
    }
    for(const a of accessories){
      const cat=sectionFor(a.category,"accessory");
      const key=`accessory:${a.catalog_item_id||`${String(a.name).toLowerCase()}:${String(a.category||"").toLowerCase()}`}`;
      const existing=map.get(key);
      if(existing){existing.available+=1;continue;}
      map.set(key,{key,item_type:"accessory",catalog_item_id:a.catalog_item_id||null,item_id:a.catalog_item_id?null:a.id,name:a.name,category:cat,available:1,internalRate:latestAccessoryRate(a.id),subtitle:a.category||"Accessory"});
    }
    for(const k of kits){map.set(`kit:${k.id}`,{key:`kit:${k.id}`,item_type:"kit",catalog_item_id:null,item_id:k.id,name:k.name,category:"Camera",available:1,internalRate:Number(k.internal_daily_rate_inr||0),subtitle:"Equipment kit"});}
    return Array.from(map.values()).sort((a,b)=>CATEGORY_ORDER.indexOf(a.category)-CATEGORY_ORDER.indexOf(b.category)||a.name.localeCompare(b.name));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[cameras,accessories,kits,rates]);

  const categories=useMemo(()=>{
    const values=new Set<string>((tab==="supplier"?supplierItems.map(x=>sectionFor(x.category)):inventory.map(x=>x.category)).filter(Boolean));
    return ["All",...CATEGORY_ORDER.filter(x=>values.has(x)),...Array.from(values).filter(x=>!CATEGORY_ORDER.includes(x)).sort()];
  },[tab,inventory,supplierItems]);

  const filteredInventory=inventory.filter(x=>(category==="All"||x.category===category)&&(!search.trim()||`${x.name} ${x.category} ${x.subtitle}`.toLowerCase().includes(search.toLowerCase())));
  const filteredSupplier=supplierItems.filter(x=>{
    const cat=sectionFor(x.category);const supplier=x.suppliers?.company_name||"";
    return (category==="All"||cat===category)&&(!search.trim()||`${x.supplier_item_name} ${x.category} ${supplier} ${x.location||""}`.toLowerCase().includes(search.toLowerCase()));
  });

  function add(row:QuotationRow){onChange([...rows,row]);}
  function patch(key:string,values:Partial<QuotationRow>){onChange(rows.map(r=>r.key===key?{...r,...values}:r));}
  function remove(key:string){onChange(rows.filter(r=>r.key!==key));if(expanded===key)setExpanded(null);}

  function addInventory(x:InventoryCandidate){
    const row:QuotationRow={key:`own:${x.key}:${Date.now()}`,item_type:x.item_type,item_id:x.item_id,request_item_id:null,catalog_item_id:x.catalog_item_id,supplier_id:null,supplier_catalog_item_id:null,section_name:x.category,requested_description:x.name,description:x.name,source_type:"own",quantity:1,rental_days:defaultRentalDays,internal_rate_inr:x.internalRate,cost_rate_inr:0,cost_rate_basis:"daily",quoted_rate_inr:x.internalRate,supplier_name:"",supplier_status:"not_required",supplier_reference:"",notes:""};
    add(row);
  }
  function addSupplier(x:SupplierCandidate){
    const supplier=x.suppliers?.company_name||"Supplier";
    const row:QuotationRow={key:`supplier:${x.id}:${Date.now()}`,item_type:"other",item_id:null,request_item_id:null,catalog_item_id:x.catalog_item_id||null,supplier_id:x.supplier_id,supplier_catalog_item_id:x.id,section_name:sectionFor(x.category),requested_description:x.supplier_item_name,description:x.supplier_item_name,source_type:"supplier",quantity:1,rental_days:defaultRentalDays,internal_rate_inr:0,cost_rate_inr:Number(x.default_cost_inr||0),cost_rate_basis:x.rate_basis||"daily",quoted_rate_inr:Number(x.default_cost_inr||0),supplier_name:supplier,supplier_status:"not_checked",supplier_reference:"",notes:""};
    add(row);
  }
  function addManual(source:SourceType){
    const service=source==="service";
    const row:QuotationRow={key:`${source}:${Date.now()}`,item_type:service?"service":"other",item_id:null,request_item_id:null,catalog_item_id:null,supplier_id:null,supplier_catalog_item_id:null,section_name:service?"Crew":"Other",requested_description:"",description:"",source_type:source,quantity:1,rental_days:defaultRentalDays,internal_rate_inr:0,cost_rate_inr:0,cost_rate_basis:"daily",quoted_rate_inr:0,supplier_name:"",supplier_status:"not_required",supplier_reference:"",notes:""};
    add(row);
  }

  const subtotal=rows.reduce((n,r)=>n+lineAmount(r),0);
  const directCost=rows.reduce((n,r)=>n+(r.source_type==="supplier"||r.source_type==="manual"||r.source_type==="service"?costTotal(r):0),0);
  const total=Math.max(0,subtotal-Math.max(0,discount)+Math.max(0,tax)+Math.max(0,otherCharges));
  const gross=Math.max(0,total-directCost);
  const margin=total>0?(gross/total)*100:0;

  return <div className="quoteBuilderV6">
    <datalist id="quote-section-presets">{SECTION_PRESETS.map(x=><option key={x} value={x}/>)}</datalist>

    <section className="quoteSourcePanel">
      <div className="quoteSourceTabs">
        <button type="button" className={tab==="inventory"?"active":""} onClick={()=>{setTab("inventory");setCategory("All")}}>Our Inventory</button>
        <button type="button" className={tab==="supplier"?"active":""} onClick={()=>{setTab("supplier");setCategory("All")}}>Supplier Network</button>
        <button type="button" className={tab==="manual"?"active":""} onClick={()=>{setTab("manual");setCategory("All")}}>Manual / Service</button>
      </div>

      {tab!=="manual"&&<>
        <label className="quoteSourceSearch"><span>Search equipment</span><div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tab==="inventory"?"Search our cameras, lenses, lights, grip…":"Search supplier equipment or supplier name…"}/>{search&&<button type="button" onClick={()=>setSearch("")} aria-label="Clear equipment search">×</button>}</div></label>
        <div className="quoteCategoryChips">{categories.map(c=><button type="button" key={c} className={category===c?"active":""} onClick={()=>setCategory(c)}>{c}</button>)}</div>
      </>}

      <div className="quoteSourceResults">
        {tab==="inventory"&&filteredInventory.map(x=><button type="button" className="quoteSourceItem" key={x.key} onClick={()=>addInventory(x)}>
          <div><b>{x.name}</b><span>{x.category} · {x.subtitle}</span></div><div className="sourceItemRight"><small>{x.available>1?`${x.available} available`:"Available"}</small><strong>{x.internalRate?money(x.internalRate):"Rate pending"}</strong><em>+ Add</em></div>
        </button>)}
        {tab==="supplier"&&filteredSupplier.map(x=><button type="button" className="quoteSourceItem supplier" key={x.id} onClick={()=>addSupplier(x)}>
          <div><b>{x.supplier_item_name}</b><span>{sectionFor(x.category)} · {x.suppliers?.company_name||"Supplier"}{x.location?` · ${x.location}`:""}</span></div><div className="sourceItemRight"><small>{Number(x.quantity_available||0)} available</small><strong>{x.default_cost_inr?`${money(x.default_cost_inr)}/${x.rate_basis}`:"Cost pending"}</strong><em>+ Add</em></div>
        </button>)}
        {tab==="manual"&&<div className="manualSourceCards">
          <button type="button" onClick={()=>addManual("manual")}><b>+ Manual Rental Item</b><span>One-off item that is not in our inventory or supplier catalog.</span></button>
          <button type="button" onClick={()=>addManual("service")}><b>+ Service / Crew</b><span>Camera assistant, DIT, transport service, post-production, labour, etc.</span></button>
          <p>Nothing here becomes permanent inventory. You can leave description, cost and rate blank and complete them later.</p>
        </div>}
        {tab!=="manual"&&((tab==="inventory"&&filteredInventory.length===0)||(tab==="supplier"&&filteredSupplier.length===0))&&<div className="quoteSourceEmpty">No matching items. Try another search/category, or use Manual / Service.</div>}
      </div>
    </section>

    <aside className="quoteCurrentPanel">
      <div className="currentQuoteHead"><div><span>CURRENT QUOTATION</span><h2>{rows.length} {rows.length===1?"item":"items"}</h2></div><small>Add items from the left. This panel stays in place.</small></div>
      <div className="currentQuoteLines">
        {rows.length===0&&<div className="currentQuoteEmpty"><b>No items added yet.</b><span>Select an inventory or supplier item on the left.</span></div>}
        {rows.map((r,index)=>{
          const open=expanded===r.key;const amount=lineAmount(r);const cost=(r.source_type==="supplier"||r.source_type==="manual"||r.source_type==="service")?costTotal(r):0;
          return <article className={`compactQuoteLine ${open?"expanded":""}`} key={r.key}>
            <div className="compactLineMain">
              <button type="button" className="compactLineToggle" onClick={()=>setExpanded(open?null:r.key)} aria-label="Edit quotation line">
                <span className="compactLineNumber">{index+1}</span>
                <div><b>{r.description||r.requested_description||"Untitled item"}</b><small>{r.section_name} · <em className={`sourceBadge ${r.source_type}`}>{r.source_type==="own"?"OWN":r.source_type==="supplier"?"SUPPLIER":r.source_type==="service"?"SERVICE":"MANUAL"}</em>{r.source_type==="supplier"&&r.supplier_name?` · ${r.supplier_name}`:""}</small></div>
              </button>
              <div className="compactLineNumbers"><label>Qty<input type="number" min="0" step="1" value={r.quantity} onChange={e=>patch(r.key,{quantity:Number(e.target.value)})}/></label><label>Days<input type="number" min="0" step=".5" value={r.rental_days} onChange={e=>patch(r.key,{rental_days:Number(e.target.value)})}/></label><label>Rate<input type="number" min="0" value={r.quoted_rate_inr} onChange={e=>patch(r.key,{quoted_rate_inr:Number(e.target.value)})}/></label><strong>{money(amount)}</strong><button type="button" className="iconButton danger" onClick={()=>remove(r.key)} aria-label={`Remove ${r.description||r.requested_description||"quotation item"}`}>×</button></div>
            </div>
            {open&&<div className="compactLineDetails">
              <label>Section<input list="quote-section-presets" value={r.section_name} onChange={e=>patch(r.key,{section_name:e.target.value})}/></label>
              <label>Customer requested<input value={r.requested_description} placeholder="Optional original wording" onChange={e=>patch(r.key,{requested_description:e.target.value})}/></label>
              <label className="wide">Quotation description<input value={r.description} placeholder="Description shown to customer" onChange={e=>patch(r.key,{description:e.target.value})}/></label>
              {r.source_type==="own"&&<div className="detailMetric"><span>Internal rate reference</span><b>{money(r.internal_rate_inr)}</b></div>}
              {(r.source_type==="supplier"||r.source_type==="manual"||r.source_type==="service")&&<><label>Internal cost<input type="number" min="0" value={r.cost_rate_inr} onChange={e=>patch(r.key,{cost_rate_inr:Number(e.target.value)})}/></label><label>Cost basis<select value={r.cost_rate_basis} onChange={e=>patch(r.key,{cost_rate_basis:e.target.value as RateBasis})}><option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="flat">Flat</option></select></label><div className="detailMetric"><span>Direct cost</span><b>{money(cost)}</b></div></>}
              {r.source_type==="supplier"&&<><div className="detailMetric"><span>Supplier</span><b>{r.supplier_name||"Not selected"}</b></div><label>Supplier reference<input value={r.supplier_reference} placeholder="Optional quote/reference" onChange={e=>patch(r.key,{supplier_reference:e.target.value})}/></label></>}
              <label className="wide">Internal note<input value={r.notes} placeholder="Optional" onChange={e=>patch(r.key,{notes:e.target.value})}/></label>
            </div>}
          </article>;
        })}
      </div>
      <div className="quotePanelTotals">
        <div><span>Subtotal</span><b>{money(subtotal)}</b></div>
        <div className="inlineAdjustment"><label>Discount<input type="number" min="0" value={discount} onChange={e=>onDiscount(Number(e.target.value))}/></label><label>Tax<input type="number" min="0" value={tax} onChange={e=>onTax(Number(e.target.value))}/></label><label>Other<input type="number" min="0" value={otherCharges} onChange={e=>onOtherCharges(Number(e.target.value))}/></label></div>
        <div className="profitStrip"><span>Direct external cost <b>{money(directCost)}</b></span><span>Est. gross margin <b>{money(gross)} · {margin.toFixed(1)}%</b></span></div>
        <div className="quotePanelGrand"><span>Grand Total</span><b>{money(total)}</b></div>
      </div>
    </aside>
  </div>;
}
