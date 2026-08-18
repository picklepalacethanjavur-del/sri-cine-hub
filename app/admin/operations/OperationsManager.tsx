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

  async function uploadEvidenceFile(file:File){
    if(!b)throw new Error("Booking not selected.");
    const path=`${b.id}/${Date.now()}-${crypto.randomUUID().slice(0,8)}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
    const up=await supabase.storage.from("rental-evidence").upload(path,file,{contentType:file.type||undefined,upsert:false});
    if(up.error)throw up.error;
    return path;
  }

  async function cleanupUploadedEvidence(paths:string[]){
    if(!paths.length)return;
    const {error}=await supabase.storage.from("rental-evidence").remove(paths);
    if(error)console.warn("Evidence cleanup failed",error.message);
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
    const uploadedPaths:string[]=[];
    try{
      if(stillMissing.length)await recordManualOverride(stillMissing,"checkout");
      const items:any[]=[];

      for(const bc of b.booking_cameras||[]){
        const hours=Number(f.get(`hours-${bc.camera_id}`)||0);
        const condition=String(f.get(`condition-${bc.camera_id}`)||"good");
        const file=f.get(`photo-camera-${bc.camera_id}`);
        if(!(file instanceof File)||!file.size)throw new Error(`Checkout proof photo is required for ${bc.cameras?.camera_code||"camera"}.`);
        const evidencePath=await uploadEvidenceFile(file);uploadedPaths.push(evidencePath);
        items.push({kind:"camera",asset_id:bc.camera_id,hours,condition,evidence_path:evidencePath});
      }

      for(const ba of b.booking_accessories||[]){
        const condition=String(f.get(`condition-${ba.accessory_id}`)||"good");
        const file=f.get(`photo-accessory-${ba.accessory_id}`);
        let evidencePath:string|null=null;
        if(file instanceof File&&file.size){evidencePath=await uploadEvidenceFile(file);uploadedPaths.push(evidencePath);}
        items.push({kind:"accessory",asset_id:ba.accessory_id,condition,evidence_path:evidencePath});
      }

      const {error}=await supabase.rpc("checkout_booking_atomic",{p_booking_id:b.id,p_items:items});
      if(error)throw error;
      setMsg(stillMissing.length?"Checkout completed with authorized verification override.":"Checkout completed.");
      setTimeout(()=>location.reload(),700);
    }catch(err){
      await cleanupUploadedEvidence(uploadedPaths);
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
    const uploadedPaths:string[]=[];
    try{
      if(stillMissing.length)await recordManualOverride(stillMissing,"return");
      const items:any[]=[];

      for(const bc of b.booking_cameras||[]){
        const hours=Number(f.get(`return-hours-${bc.camera_id}`)||0);
        const condition=String(f.get(`return-condition-${bc.camera_id}`)||"good");
        const file=f.get(`return-photo-camera-${bc.camera_id}`);
        if(!(file instanceof File)||!file.size)throw new Error(`Return proof photo is required for ${bc.cameras?.camera_code||"camera"}.`);
        const evidencePath=await uploadEvidenceFile(file);uploadedPaths.push(evidencePath);
        items.push({kind:"camera",asset_id:bc.camera_id,hours,condition,evidence_path:evidencePath});
      }

      for(const ba of b.booking_accessories||[]){
        const condition=String(f.get(`return-condition-${ba.accessory_id}`)||"good");
        const file=f.get(`return-photo-accessory-${ba.accessory_id}`);
        let evidencePath:string|null=null;
        if(file instanceof File&&file.size){evidencePath=await uploadEvidenceFile(file);uploadedPaths.push(evidencePath);}
        items.push({kind:"accessory",asset_id:ba.accessory_id,condition,evidence_path:evidencePath});
      }

      const {data,error}=await supabase.rpc("return_booking_atomic",{
        p_booking_id:b.id,p_items:items,
        p_damage_inr:Number(f.get("damage")||0),p_late_inr:Number(f.get("late")||0),p_other_inr:Number(f.get("other")||0),p_paid_inr:Number(f.get("paid")||0),
        p_payment_method:String(f.get("method")||"")||null,p_payment_reference:String(f.get("reference")||"")||null,p_notes:String(f.get("notes")||"")||null
      });
      if(error)throw error;
      const result=data as {receipt_id?:string;receipt_code?:string};
      setMsg(stillMissing.length?"Return completed with authorized verification override; receipt generated.":"Return completed and receipt generated.");
      setTimeout(()=>{location.href=result?.receipt_id?`/admin/receipts/${result.receipt_id}/print?generated=1`:"/admin/receipts";},850);
    }catch(err){
      await cleanupUploadedEvidence(uploadedPaths);
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
