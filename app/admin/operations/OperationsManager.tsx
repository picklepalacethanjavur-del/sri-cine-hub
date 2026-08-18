"use client";
import {useMemo,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {AssetScanner,normalizeAssetCode,type ScanMethod} from "@/components/AssetScanner";

type AssetRef={
  key:string;
  kind:"camera"|"accessory";
  assetId:string;
  bookingLineId:string;
  code:string;
  label:string;
};

export function OperationsManager({bookings,userId}:{bookings:any[];userId:string}){
  const supabase=createClient();
  const [bookingId,setBookingId]=useState("");
  const [verified,setVerified]=useState<string[]>([]);
  const [msg,setMsg]=useState("");
  const [busy,setBusy]=useState<"checkout"|"return"|null>(null);
  const [overrideMissing,setOverrideMissing]=useState(false);
  const [overrideReason,setOverrideReason]=useState("");

  const b=bookings.find(x=>x.id===bookingId);
  const isReturn=!!b&&["checked_out","overdue"].includes(b.status);
  const flowType:"checkout"|"return"=isReturn?"return":"checkout";

  const expectedAssets=useMemo<AssetRef[]>(()=>{
    if(!b)return [];
    const cameras=(b.booking_cameras||[]).map((bc:any)=>({
      key:`camera:${bc.camera_id}`,
      kind:"camera" as const,
      assetId:bc.camera_id,
      bookingLineId:bc.id,
      code:normalizeAssetCode(bc.cameras?.qr_code||""),
      label:`${bc.cameras?.camera_code||""} · ${bc.cameras?.name||"Camera"}`
    }));
    const accessories=(b.booking_accessories||[]).map((ba:any)=>({
      key:`accessory:${ba.accessory_id}`,
      kind:"accessory" as const,
      assetId:ba.accessory_id,
      bookingLineId:ba.id,
      code:normalizeAssetCode(ba.accessories?.qr_code||""),
      label:`${ba.accessories?.accessory_code||""} · ${ba.accessories?.name||"Accessory"}`
    }));
    return [...cameras,...accessories].filter(x=>x.code);
  },[b]);

  const expectedCodes=expectedAssets.map(x=>x.code);
  const missing=expectedCodes.filter(code=>!verified.includes(code));

  function resetVerification(){
    setVerified([]);setMsg("");setOverrideMissing(false);setOverrideReason("");
  }

  async function recordScan(codeRaw:string,method:ScanMethod){
    if(!b)return;
    const code=normalizeAssetCode(codeRaw);
    const match=expectedAssets.find(x=>x.code===code);
    if(!match){setMsg(`${code||"That code"} is not assigned to this booking.`);return;}
    if(verified.includes(code)){setMsg(`${code} is already verified.`);return;}
    setVerified(current=>[...current,code]);
    const {error}=await supabase.from("asset_scan_events").insert({
      booking_id:b.id,
      camera_id:match.kind==="camera"?match.assetId:null,
      accessory_id:match.kind==="accessory"?match.assetId:null,
      scan_type:flowType,
      scan_method:method,
      result:"matched",
      scanned_by:userId,
      notes:`${flowType==="checkout"?"Checkout":"Return"} verification for ${match.label}`
    });
    if(error)console.warn("Scan audit insert failed",error.message);
    setMsg(`${code} verified.`);
  }

  async function uploadEvidence(file:File,asset:AssetRef,evidenceType:"checkout_hours"|"return_hours"|"condition"|"damage",hours?:number){
    if(!b)return;
    const path=`${b.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
    const up=await supabase.storage.from("rental-evidence").upload(path,file);
    if(up.error)throw up.error;
    const ev=await supabase.from("evidence").insert({
      booking_id:b.id,
      camera_id:asset.kind==="camera"?asset.assetId:null,
      accessory_id:asset.kind==="accessory"?asset.assetId:null,
      evidence_type:evidenceType,
      file_path:path,
      camera_hours:asset.kind==="camera"?(hours??null):null,
      captured_by:userId
    });
    if(ev.error)throw ev.error;
  }

  async function recordManualOverride(codes:string[],scanType:"checkout"|"return"){
    if(!b||!codes.length)return;
    for(const code of codes){
      const asset=expectedAssets.find(x=>x.code===code);
      if(!asset)continue;
      const {error}=await supabase.from("asset_scan_events").insert({
        booking_id:b.id,
        camera_id:asset.kind==="camera"?asset.assetId:null,
        accessory_id:asset.kind==="accessory"?asset.assetId:null,
        scan_type:scanType,
        scan_method:"manual",
        result:"missing",
        scanned_by:userId,
        notes:`Authorized ${scanType} verification override. Expected ${code}. Reason: ${overrideReason.trim()}`
      });
      if(error)throw error;
    }
  }

  function validateVerification(){
    const stillMissing=expectedCodes.filter(code=>!verified.includes(code));
    if(stillMissing.length&&!overrideMissing){
      setMsg(`Verify: ${stillMissing.join(", ")}. Scan/enter the code, or use Manual verification override.`);
      return null;
    }
    if(stillMissing.length&&overrideMissing&&overrideReason.trim().length<4){
      setMsg("Enter a short reason for the manual verification override.");
      return null;
    }
    return stillMissing;
  }

  async function checkout(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!b||busy)return;
    const form=e.currentTarget;
    const f=new FormData(form); // Capture synchronously before any await.
    const stillMissing=validateVerification();
    if(stillMissing===null)return;

    setBusy("checkout");setMsg("");
    try{
      if(stillMissing.length)await recordManualOverride(stillMissing,"checkout");

      for(const bc of b.booking_cameras||[]){
        const hours=Number(f.get(`hours-${bc.camera_id}`)||0);
        const cond=String(f.get(`condition-${bc.camera_id}`)||"good");
        const line=await supabase.from("booking_cameras").update({checkout_hours:hours,condition_out:cond}).eq("id",bc.id);
        if(line.error)throw line.error;
        const cam=await supabase.from("cameras").update({status:"out",current_hours:hours}).eq("id",bc.camera_id);
        if(cam.error)throw cam.error;
        const file=f.get(`photo-camera-${bc.camera_id}`);
        const asset=expectedAssets.find(x=>x.kind==="camera"&&x.assetId===bc.camera_id);
        if(asset&&file instanceof File&&file.size)await uploadEvidence(file,asset,"checkout_hours",hours);
      }

      for(const ba of b.booking_accessories||[]){
        const cond=String(f.get(`condition-${ba.accessory_id}`)||"good");
        const line=await supabase.from("booking_accessories").update({condition_out:cond}).eq("id",ba.id);
        if(line.error)throw line.error;
        const accessory=await supabase.from("accessories").update({status:"out"}).eq("id",ba.accessory_id);
        if(accessory.error)throw accessory.error;
        const file=f.get(`photo-accessory-${ba.accessory_id}`);
        const asset=expectedAssets.find(x=>x.kind==="accessory"&&x.assetId===ba.accessory_id);
        if(asset&&file instanceof File&&file.size)await uploadEvidence(file,asset,"condition");
      }

      const bookingUpdate=await supabase.from("bookings").update({status:"checked_out",checked_out_at:new Date().toISOString()}).eq("id",b.id);
      if(bookingUpdate.error)throw bookingUpdate.error;
      setMsg(stillMissing.length?"Checkout completed with authorized verification override.":"Checkout completed.");
      setTimeout(()=>location.reload(),700);
    }catch(err){
      setMsg(err instanceof Error?err.message:"Checkout failed.");
      setBusy(null);
    }
  }

  async function returnRental(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!b||busy)return;
    const form=e.currentTarget;
    const f=new FormData(form); // Capture synchronously before any await.
    const stillMissing=validateVerification();
    if(stillMissing===null)return;

    setBusy("return");setMsg("");
    try{
      if(stillMissing.length)await recordManualOverride(stillMissing,"return");

      let hasDamagedAsset=false;
      for(const bc of b.booking_cameras||[]){
        const hours=Number(f.get(`return-hours-${bc.camera_id}`)||0);
        const cond=String(f.get(`return-condition-${bc.camera_id}`)||"good");
        if(cond==="damaged"||cond==="missing")hasDamagedAsset=true;
        const line=await supabase.from("booking_cameras").update({return_hours:hours,condition_in:cond}).eq("id",bc.id);
        if(line.error)throw line.error;
        const cam=await supabase.from("cameras").update({status:cond==="good"||cond==="fair"?"available":"maintenance",current_hours:hours}).eq("id",bc.camera_id);
        if(cam.error)throw cam.error;
        const file=f.get(`return-photo-camera-${bc.camera_id}`);
        const asset=expectedAssets.find(x=>x.kind==="camera"&&x.assetId===bc.camera_id);
        if(asset&&file instanceof File&&file.size)await uploadEvidence(file,asset,cond==="damaged"||cond==="missing"?"damage":"return_hours",hours);
      }

      for(const ba of b.booking_accessories||[]){
        const cond=String(f.get(`return-condition-${ba.accessory_id}`)||"good");
        if(cond==="damaged"||cond==="missing")hasDamagedAsset=true;
        const line=await supabase.from("booking_accessories").update({condition_in:cond}).eq("id",ba.id);
        if(line.error)throw line.error;
        const accessory=await supabase.from("accessories").update({status:cond==="good"||cond==="fair"?"available":"maintenance"}).eq("id",ba.accessory_id);
        if(accessory.error)throw accessory.error;
        const file=f.get(`return-photo-accessory-${ba.accessory_id}`);
        const asset=expectedAssets.find(x=>x.kind==="accessory"&&x.assetId===ba.accessory_id);
        if(asset&&file instanceof File&&file.size)await uploadEvidence(file,asset,cond==="damaged"||cond==="missing"?"damage":"condition");
      }

      const damage=Number(f.get("damage")||0),late=Number(f.get("late")||0),other=Number(f.get("other")||0),paid=Number(f.get("paid")||0);
      const rental=Number(b.quoted_total_inr||0);
      const balance=Math.max(0,rental+damage+late+other-paid);
      const bookingUpdate=await supabase.from("bookings").update({status:"returned",returned_at:new Date().toISOString(),amount_received_inr:paid,payment_status:balance>0?"partial":"paid"}).eq("id",b.id);
      if(bookingUpdate.error)throw bookingUpdate.error;
      const receipt=await supabase.from("receipts").upsert({booking_id:b.id,customer_id:b.customer_id,rental_amount_inr:rental,damage_charges_inr:damage,late_charges_inr:late,other_charges_inr:other,amount_paid_inr:paid,balance_inr:balance,payment_method:String(f.get("method")||""),payment_reference:String(f.get("reference")||""),return_notes:String(f.get("notes")||"")+(hasDamagedAsset?"\nOne or more owned assets were marked damaged/missing and moved to maintenance.":""),issued_by:userId},{onConflict:"booking_id"});
      if(receipt.error)throw receipt.error;
      setMsg(stillMissing.length?"Return completed with authorized verification override; receipt generated.":"Return completed and receipt generated.");
      setTimeout(()=>location.href="/admin/receipts",900);
    }catch(err){
      setMsg(err instanceof Error?err.message:"Return failed.");
      setBusy(null);
    }
  }

  function verificationPanel(){
    return <>
      <p className="formNote">Scan the QR label or enter the printed code. Camera and accessory codes are verified against this booking.</p>
      <AssetScanner title={flowType==="checkout"?"Verify equipment for checkout":"Verify returned equipment"} onCode={recordScan}/>
      <div className="scanSummary"><b>Required {expectedCodes.length}</b><span>Verified {verified.length} / {expectedCodes.length}</span></div>
      <div className="checkoutVerificationList">
        {expectedAssets.map(asset=>{
          const ok=verified.includes(asset.code);
          return <div className={`checkoutVerificationRow ${ok?"verified":"pending"}`} key={asset.key}>
            <div><b>{asset.label}</b><span>{asset.code}</span></div><em>{ok?"✓ VERIFIED":"PENDING"}</em>
          </div>;
        })}
        {expectedAssets.length===0&&<div className="formNote">No QR-tracked owned assets are assigned to this booking.</div>}
      </div>
      {missing.length>0&&<div className="checkoutOverrideBox">
        <label className="overrideToggle"><input type="checkbox" checked={overrideMissing} onChange={e=>setOverrideMissing(e.target.checked)}/><span><b>Manual verification override</b><small>Use only when the physical asset is present but its label cannot be read.</small></span></label>
        {overrideMissing&&<label>Override reason<input value={overrideReason} onChange={e=>setOverrideReason(e.target.value)} placeholder="Example: QR label damaged; serial physically verified"/></label>}
      </div>}
    </>;
  }

  return <>
    <div className="adminPanel formPanel">
      <h2>Select active booking</h2>
      <label>Booking<select value={bookingId} disabled={!!busy} onChange={e=>{setBookingId(e.target.value);resetVerification();}}><option value="">Choose booking</option>{bookings.map(x=><option key={x.id} value={x.id}>{x.booking_code} · {x.production_name||"Client"} · {x.status}</option>)}</select></label>
    </div>

    {b&&["reserved","confirmed","preparing"].includes(b.status)&&<form className="adminPanel formPanel" onSubmit={checkout}>
      <h2>Equipment verification & checkout</h2>
      {verificationPanel()}
      {(b.booking_cameras||[]).map((bc:any)=><div className="assetOperation" key={bc.id}>
        <h3>{bc.cameras.camera_code} · {bc.cameras.name}</h3><span>QR {bc.cameras.qr_code}</span>
        <div className="formGrid"><label>Checkout camera hours<input required name={`hours-${bc.camera_id}`} type="number" step=".1" min="0" defaultValue={bc.cameras.current_hours||0}/></label><label>Condition out<select name={`condition-${bc.camera_id}`} defaultValue="good"><option value="good">Good</option><option value="fair">Fair</option><option value="damaged">Damaged</option></select></label></div>
        <label>Checkout proof photo<input required name={`photo-camera-${bc.camera_id}`} type="file" accept="image/*" capture="environment"/></label>
      </div>)}
      {(b.booking_accessories||[]).map((ba:any)=><div className="assetOperation" key={ba.id}>
        <h3>{ba.accessories.accessory_code} · {ba.accessories.name}</h3><span>QR {ba.accessories.qr_code}</span>
        <label>Condition out<select name={`condition-${ba.accessory_id}`} defaultValue="good"><option value="good">Good</option><option value="fair">Fair</option><option value="damaged">Damaged</option></select></label>
        <label>Accessory proof photo <small>(optional)</small><input name={`photo-accessory-${ba.accessory_id}`} type="file" accept="image/*" capture="environment"/></label>
      </div>)}
      <button type="submit" className="button gold" disabled={!!busy}>{busy==="checkout"?"Checking Out…":missing.length&&!overrideMissing?`Verify ${missing.length} item${missing.length===1?"":"s"} to checkout`:"Complete checkout"}</button>
    </form>}

    {b&&["checked_out","overdue"].includes(b.status)&&<form className="adminPanel formPanel" onSubmit={returnRental}>
      <h2>Return equipment & final receipt</h2>
      {verificationPanel()}
      {(b.booking_cameras||[]).map((bc:any)=><div className="assetOperation" key={bc.id}>
        <h3>{bc.cameras.camera_code} · {bc.cameras.name}</h3>
        <div className="formGrid"><label>Return camera hours<input required name={`return-hours-${bc.camera_id}`} type="number" step=".1" min={bc.checkout_hours||0} defaultValue={bc.checkout_hours||bc.cameras.current_hours||0}/></label><label>Condition in<select name={`return-condition-${bc.camera_id}`} defaultValue="good"><option value="good">Good</option><option value="fair">Fair</option><option value="damaged">Damaged</option><option value="missing">Missing</option></select></label></div>
        <label>Return proof photo<input required name={`return-photo-camera-${bc.camera_id}`} type="file" accept="image/*" capture="environment"/></label>
      </div>)}
      {(b.booking_accessories||[]).map((ba:any)=><div className="assetOperation" key={ba.id}>
        <h3>{ba.accessories.accessory_code} · {ba.accessories.name}</h3>
        <label>Condition in<select name={`return-condition-${ba.accessory_id}`} defaultValue="good"><option value="good">Good</option><option value="fair">Fair</option><option value="damaged">Damaged</option><option value="missing">Missing</option></select></label>
        <label>Accessory return photo <small>(optional)</small><input name={`return-photo-accessory-${ba.accessory_id}`} type="file" accept="image/*" capture="environment"/></label>
      </div>)}
      <div className="formGrid"><label>Damage charges ₹<input name="damage" type="number" min="0" defaultValue="0"/></label><label>Late charges ₹<input name="late" type="number" min="0" defaultValue="0"/></label></div>
      <div className="formGrid"><label>Other charges ₹<input name="other" type="number" min="0" defaultValue="0"/></label><label>Total amount paid ₹<input name="paid" type="number" min="0" defaultValue="0"/></label></div>
      <div className="formGrid"><label>Payment method<select name="method" defaultValue=""><option value="">Not specified</option><option>UPI</option><option>Bank Transfer</option><option>Cash</option><option>Card</option></select></label><label>Payment reference<input name="reference" placeholder="UPI / bank / card reference"/></label></div>
      <label>Return / damage notes<textarea name="notes" placeholder="Optional notes"/></label>
      <button type="submit" className="button gold" disabled={!!busy}>{busy==="return"?"Processing Return…":missing.length&&!overrideMissing?`Verify ${missing.length} item${missing.length===1?"":"s"} to return`:"Return equipment & generate receipt"}</button>
    </form>}

    {msg&&<div className={msg.includes("completed")||msg.includes("verified")||msg.includes("already verified")?"successBox":"errorBox"} role="status">{msg}</div>}
    {busy&&<div className="actionOverlay" role="status" aria-live="polite"><div className="actionOverlayCard"><span className="loadingSpinner"/><b>{busy==="checkout"?"Completing checkout…":"Returning equipment & generating receipt…"}</b><small>Please wait while rental records, asset status and evidence are updated.</small></div></div>}
  </>;
}
