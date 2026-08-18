"use client";

import {useRef,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {DateTimePicker} from "@/components/DateTimePicker";

export function NewExternalQuoteRequest({userId:_userId}:{userId:string}){
  const supabase=createClient();
  const [open,setOpen]=useState(false);
  const [start,setStart]=useState("");
  const [end,setEnd]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const fileInputRef=useRef<HTMLInputElement|null>(null);
  const [fileNames,setFileNames]=useState<string[]>([]);

  async function assertStaffSession(){
    const {data:{user},error}=await supabase.auth.getUser();
    if(error||!user)throw new Error("Your staff session expired. Sign in again before creating a quote request.");
    const {data:allowed,error:roleError}=await supabase.rpc("is_active_staff");
    if(roleError)throw roleError;
    if(!allowed)throw new Error("Your account does not currently have active staff access.");
  }

  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(busy)return;
    if(start&&end&&new Date(end)<=new Date(start)){
      setMessage("Return must be after start when both dates are entered.");
      return;
    }

    const form=e.currentTarget;
    const f=new FormData(form); // capture synchronously before any await
    setBusy(true);
    setMessage("");

    try{
      await assertStaffSession();
      const {data,error}=await supabase.rpc("staff_create_quote_request",{
        p_name:String(f.get("name")||"").trim()||null,
        p_company_name:String(f.get("company")||"").trim()||null,
        p_phone:String(f.get("phone")||"").trim()||null,
        p_project_name:String(f.get("project")||"").trim()||null,
        p_start_at:start?new Date(start).toISOString():null,
        p_end_at:end?new Date(end).toISOString():null,
        p_notes:String(f.get("notes")||"").trim()||null,
      });
      if(error)throw error;
      const req=data as {id:string;request_code:string};
      if(!req?.id)throw new Error("Quote request was not created. Please try again.");

      const files=f.getAll("requestFiles").filter(x=>x instanceof File&&x.size) as File[];
      const failed:string[]=[];
      for(const file of files){
        try{
          if(file.size>25*1024*1024)throw new Error("File exceeds 25 MB");
          const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
          const path=`${req.id}/${Date.now()}-${crypto.randomUUID().slice(0,8)}-${safe}`;
          const up=await supabase.storage.from("quote-request-documents").upload(path,file,{contentType:file.type||undefined,upsert:false});
          if(up.error)throw up.error;
          const meta=await supabase.rpc("staff_add_quote_request_attachment",{
            p_quote_request_id:req.id,
            p_file_name:file.name,
            p_file_path:path,
            p_content_type:file.type||null,
            p_file_size:file.size,
          });
          if(meta.error){
            await supabase.storage.from("quote-request-documents").remove([path]);
            throw meta.error;
          }
        }catch{
          failed.push(file.name);
        }
      }

      if(failed.length){
        sessionStorage.setItem("quoteRequestUploadWarning",`Request created, but upload again: ${failed.join(", ")}`);
      }
      location.href=`/admin/quote-requests/${req.id}`;
    }catch(err){
      const raw=err instanceof Error?err.message:"Unable to create quote request.";
      setMessage(raw.includes("row-level security")?"Staff authorization failed while creating the request. Sign out and back in, then retry.":raw);
      setBusy(false);
    }
  }

  return <div className="newExternalRequestWrap">
    <button className="button gold" type="button" onClick={()=>setOpen(v=>!v)}>{open?"Close":"+ New Request"}</button>
    {open&&<form className="adminPanel externalRequestForm" onSubmit={submit}>
      <div className="panelHeading"><div><h2>Start a quotation request</h2><p>Everything is optional. Create the workspace first, then add customer details, dates, files and items as they arrive.</p></div></div>
      <div className="formGrid"><label>Production / Client<input name="company"/></label><label>Project<input name="project"/></label></div>
      <div className="formGrid"><label>Contact name<input name="name"/></label><label>Phone / WhatsApp<input name="phone"/></label></div>
      <div className="formGrid"><DateTimePicker label="Start (optional)" value={start} onChange={setStart}/><DateTimePicker label="Return (optional)" value={end} min={start} onChange={setEnd}/></div>
      <div className="requestFilePicker">
        <span className="fieldLabel">Original request document(s)</span>
        <input ref={fileInputRef} aria-label="Original customer request documents" style={{display:"none"}} name="requestFiles" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.doc,.docx,application/pdf,image/*" onChange={e=>setFileNames(Array.from(e.target.files||[]).map(x=>x.name))}/>
        <button type="button" className="button ghost" onClick={()=>fileInputRef.current?.click()}>+ Attach Request Files</button>
        <small>{fileNames.length?fileNames.join(", "):"No request files attached yet."}</small>
      </div>
      <label>Internal note<textarea name="notes" rows={3} placeholder="Optional"/></label>
      <div className="formActions"><button type="submit" className="button gold" disabled={busy}>{busy?"Creating…":"Create Request & Open Builder"}</button></div>
      {message&&<div className="errorBox">{message}</div>}
      {busy&&<div className="actionOverlay" role="status" aria-live="polite"><div className="actionOverlayCard"><span className="loadingSpinner"/><b>Creating request…</b><small>Checking staff access and preparing the quotation workspace.</small></div></div>}
    </form>}
  </div>;
}
