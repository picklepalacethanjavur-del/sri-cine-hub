"use client";
import {useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {AssetScanner,normalizeAssetCode,type ScanMethod} from "@/components/AssetScanner";

export function OperationsManager({bookings,userId}:{bookings:any[];userId:string}){
  const supabase=createClient();
  const [bookingId,setBookingId]=useState("");
  const [scanned,setScanned]=useState<string[]>([]);
  const [msg,setMsg]=useState("");
  const [busy,setBusy]=useState<"checkout"|"return"|null>(null);
  const [overrideMissing,setOverrideMissing]=useState(false);
  const [overrideReason,setOverrideReason]=useState("");

  const b=bookings.find(x=>x.id===bookingId);
  const expectedAssets=(b?.booking_cameras||[]).map((bc:any)=>({
    bookingCameraId:bc.id,
    cameraId:bc.camera_id,
    code:normalizeAssetCode(bc.cameras?.qr_code||""),
    label:`${bc.cameras?.camera_code||""} · ${bc.cameras?.name||"Camera"}`
  })).filter((x:any)=>x.code);
  const expected=expectedAssets.map((x:any)=>x.code);
  const missing=expected.filter((code:string)=>!scanned.includes(code));

  async function recordScan(code:string,method:ScanMethod){
    const match=expectedAssets.find((x:any)=>x.code===code);
    if(!match){
      setMsg(`${code} is not assigned to this booking.`);
      return;
    }
    if(!scanned.includes(code)){
      setScanned(current=>[...current,code]);
      const {error}=await supabase.from("asset_scan_events").insert({
        booking_id:b.id,
        camera_id:match.cameraId,
        scan_type:"checkout",
        scan_method:method,
        result:"matched",
        scanned_by:userId,
        notes:`Checkout verification for ${match.label}`
      });
      if(error) console.warn("Scan audit insert failed",error.message);
    }
    setMsg(`${code} verified.`);
  }

  async function uploadPhoto(file:File,bookingId:string,cameraId:string,type:string,hours?:number){
    const path=`${bookingId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
    const up=await supabase.storage.from("rental-evidence").upload(path,file);
    if(up.error)throw up.error;
    const ev=await supabase.from("evidence").insert({booking_id:bookingId,camera_id:cameraId,evidence_type:type,file_path:path,camera_hours:hours||null,captured_by:userId});
    if(ev.error)throw ev.error;
  }

  async function recordManualOverride(){
    if(!missing.length)return;
    for(const code of missing){
      const asset=expectedAssets.find((x:any)=>x.code===code);
      if(!asset)continue;
      const {error}=await supabase.from("asset_scan_events").insert({
        booking_id:b.id,
        camera_id:asset.cameraId,
        scan_type:"checkout",
        scan_method:"manual",
        result:"missing",
        scanned_by:userId,
        notes:`Authorized checkout override. Expected ${code}. Reason: ${overrideReason.trim()}`
      });
      if(error)throw error;
    }
  }

  async function checkout(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!b||busy)return;

    const stillMissing=expected.filter((x:string)=>!scanned.includes(x));
    if(stillMissing.length&&!overrideMissing){
      setMsg(`Verify or scan: ${stillMissing.join(", ")}. If the label cannot be scanned, use Manual checkout override below.`);
      return;
    }
    if(stillMissing.length&&overrideMissing&&overrideReason.trim().length<4){
      setMsg("Enter a short reason for the manual checkout override.");
      return;
    }

    setBusy("checkout");setMsg("");
    try{
      if(stillMissing.length)await recordManualOverride();

      const f=new FormData(e.currentTarget);
      for(const bc of b.booking_cameras){
        const hours=Number(f.get(`hours-${bc.camera_id}`)||0);
        const cond=String(f.get(`condition-${bc.camera_id}`)||"good");
        const bcUpdate=await supabase.from("booking_cameras").update({checkout_hours:hours,condition_out:cond}).eq("id",bc.id);
        if(bcUpdate.error)throw bcUpdate.error;
        const camUpdate=await supabase.from("cameras").update({status:"out",current_hours:hours}).eq("id",bc.camera_id);
        if(camUpdate.error)throw camUpdate.error;
        const file=f.get(`photo-${bc.camera_id}`);
        if(file instanceof File&&file.size)await uploadPhoto(file,b.id,bc.camera_id,"checkout_hours",hours);
      }

      const bookingUpdate=await supabase.from("bookings").update({status:"checked_out",checked_out_at:new Date().toISOString()}).eq("id",b.id);
      if(bookingUpdate.error)throw bookingUpdate.error;
      setMsg(stillMissing.length?"Checkout completed with authorized scan override.":"Checkout completed.");
      setTimeout(()=>location.reload(),700);
    }catch(e){
      setMsg(e instanceof Error?e.message:"Checkout failed.");
      setBusy(null);
    }
  }

  async function returnRental(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!b||busy)return;
    setBusy("return");setMsg("");
    try{
      const f=new FormData(e.currentTarget);
      const damage=Number(f.get("damage")||0),late=Number(f.get("late")||0),other=Number(f.get("other")||0),paid=Number(f.get("paid")||0);
      for(const bc of b.booking_cameras){
        const hours=Number(f.get(`return-hours-${bc.camera_id}`)||0);
        const cond=String(f.get(`return-condition-${bc.camera_id}`)||"good");
        const bcUpdate=await supabase.from("booking_cameras").update({return_hours:hours,condition_in:cond}).eq("id",bc.id);
        if(bcUpdate.error)throw bcUpdate.error;
        const camUpdate=await supabase.from("cameras").update({status:"available",current_hours:hours}).eq("id",bc.camera_id);
        if(camUpdate.error)throw camUpdate.error;
        const file=f.get(`return-photo-${bc.camera_id}`);
        if(file instanceof File&&file.size)await uploadPhoto(file,b.id,bc.camera_id,"return_hours",hours);
      }
      const rental=Number(b.quoted_total_inr||0);
      const balance=Math.max(0,rental+damage+late+other-paid);
      const bookingUpdate=await supabase.from("bookings").update({status:"returned",returned_at:new Date().toISOString(),amount_received_inr:paid,payment_status:balance>0?"partial":"paid"}).eq("id",b.id);
      if(bookingUpdate.error)throw bookingUpdate.error;
      const receipt=await supabase.from("receipts").upsert({booking_id:b.id,customer_id:b.customer_id,rental_amount_inr:rental,damage_charges_inr:damage,late_charges_inr:late,other_charges_inr:other,amount_paid_inr:paid,balance_inr:balance,payment_method:String(f.get("method")||""),payment_reference:String(f.get("reference")||""),return_notes:String(f.get("notes")||""),issued_by:userId},{onConflict:"booking_id"});
      if(receipt.error)throw receipt.error;
      setMsg("Return completed and receipt generated.");
      setTimeout(()=>location.href="/admin/receipts",900);
    }catch(e){
      setMsg(e instanceof Error?e.message:"Return failed.");
      setBusy(null);
    }
  }

  return <>
    <div className="adminPanel formPanel">
      <h2>Select active booking</h2>
      <select value={bookingId} disabled={!!busy} onChange={e=>{setBookingId(e.target.value);setScanned([]);setMsg("");setOverrideMissing(false);setOverrideReason("")}}>
        <option value="">Choose booking</option>
        {bookings.map(b=><option key={b.id} value={b.id}>{b.booking_code} · {b.production_name||"Client"} · {b.status}</option>)}
      </select>
    </div>

    {b&&["reserved","confirmed","preparing"].includes(b.status)&&<form className="adminPanel formPanel" onSubmit={checkout}>
      <h2>Equipment verification & checkout</h2>
      <p className="formNote">Scan the QR label or enter the printed equipment code. Codes are matched without case/spacing differences.</p>

      <AssetScanner onCode={recordScan}/>

      <div className="scanSummary"><b>Required {expected.length}</b><span>Verified {scanned.length} / {expected.length}</span></div>
      <div className="checkoutVerificationList">
        {expectedAssets.map((asset:any)=>{
          const ok=scanned.includes(asset.code);
          return <div className={`checkoutVerificationRow ${ok?"verified":"pending"}`} key={asset.cameraId}>
            <div><b>{asset.label}</b><span>{asset.code}</span></div>
            <em>{ok?"✓ VERIFIED":"PENDING"}</em>
          </div>;
        })}
      </div>

      {missing.length>0&&<div className="checkoutOverrideBox">
        <label className="overrideToggle">
          <input type="checkbox" checked={overrideMissing} onChange={e=>setOverrideMissing(e.target.checked)}/>
          <span><b>Manual checkout override</b><small>Use only when the physical asset is present but its QR label cannot be read.</small></span>
        </label>
        {overrideMissing&&<label>Override reason
          <input value={overrideReason} onChange={e=>setOverrideReason(e.target.value)} placeholder="Example: QR label damaged; serial physically verified"/>
        </label>}
      </div>}

      {b.booking_cameras.map((bc:any)=><div className="assetOperation" key={bc.id}>
        <h3>{bc.cameras.camera_code} · {bc.cameras.name}</h3><span>QR {bc.cameras.qr_code}</span>
        <div className="formGrid"><input required name={`hours-${bc.camera_id}`} type="number" step=".1" placeholder="Camera hours"/><select name={`condition-${bc.camera_id}`}><option>good</option><option>fair</option><option>damaged</option></select></div>
        <label>Checkout proof photo<input required name={`photo-${bc.camera_id}`} type="file" accept="image/*" capture="environment"/></label>
      </div>)}

      <button className="button gold" disabled={!!busy}>
        {busy==="checkout"?"Checking Out…":missing.length&&!overrideMissing?`Verify ${missing.length} item${missing.length===1?"":"s"} to checkout`:"Complete checkout"}
      </button>
    </form>}

    {b&&["checked_out","overdue"].includes(b.status)&&<form className="adminPanel formPanel" onSubmit={returnRental}>
      <h2>Return & final receipt</h2>
      {b.booking_cameras.map((bc:any)=><div className="assetOperation" key={bc.id}>
        <h3>{bc.cameras.camera_code} · {bc.cameras.name}</h3>
        <div className="formGrid"><input required name={`return-hours-${bc.camera_id}`} type="number" step=".1" min={bc.checkout_hours||0} placeholder="Return hours"/><select name={`return-condition-${bc.camera_id}`}><option>good</option><option>fair</option><option>damaged</option><option>missing</option></select></div>
        <label>Return proof photo<input required name={`return-photo-${bc.camera_id}`} type="file" accept="image/*" capture="environment"/></label>
      </div>)}
      <div className="formGrid"><input name="damage" type="number" placeholder="Damage charge ₹"/><input name="late" type="number" placeholder="Late charge ₹"/></div>
      <div className="formGrid"><input name="other" type="number" placeholder="Other charge ₹"/><input name="paid" type="number" placeholder="Total amount paid ₹"/></div>
      <div className="formGrid"><select name="method"><option value="">Payment method</option><option>UPI</option><option>Bank Transfer</option><option>Cash</option><option>Card</option></select><input name="reference" placeholder="Payment reference"/></div>
      <textarea name="notes" placeholder="Return notes / damage notes"/>
      <button className="button gold" disabled={!!busy}>{busy==="return"?"Processing Return…":"Return equipment & generate receipt"}</button>
    </form>}

    {msg&&<div className={msg.includes("completed")||msg.includes("verified")?"successBox":"errorBox"}>{msg}</div>}
    {busy&&<div className="actionOverlay" role="status" aria-live="polite"><div className="actionOverlayCard"><span className="loadingSpinner"/><b>{busy==="checkout"?"Completing checkout…":"Returning equipment & generating receipt…"}</b><small>Please wait while the rental records and evidence are updated.</small></div></div>}
  </>;
}
