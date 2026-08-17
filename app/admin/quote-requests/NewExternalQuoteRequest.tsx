"use client";
import {useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {DateTimePicker} from "@/components/DateTimePicker";

export function NewExternalQuoteRequest({userId}:{userId:string}){
  const supabase=createClient();
  const [open,setOpen]=useState(false);
  const [start,setStart]=useState("");
  const [end,setEnd]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(busy)return;
    if(!start||!end||new Date(end)<=new Date(start)){setMessage("Choose a valid rental period.");return;}
    setBusy(true);setMessage("");
    const form=e.currentTarget;
    try{
      const f=new FormData(form);
      const {data:req,error}=await supabase.from("quote_requests").insert({
        name:String(f.get("name")||"").trim(),
        company_name:String(f.get("company")||"").trim()||null,
        phone:String(f.get("phone")||"").trim(),
        project_name:String(f.get("project")||"").trim()||null,
        start_at:new Date(start).toISOString(),
        end_at:new Date(end).toISOString(),
        notes:String(f.get("notes")||"").trim()||null,
        status:"new"
      }).select("id,request_code").single();
      if(error)throw error;

      const files=f.getAll("requestFiles").filter(x=>x instanceof File&&x.size) as File[];
      const failed:string[]=[];
      for(const file of files){
        try{
          if(file.size>25*1024*1024)throw new Error("File exceeds 25 MB");
          const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
          const path=`${req.id}/${Date.now()}-${crypto.randomUUID().slice(0,8)}-${safe}`;
          const up=await supabase.storage.from("quote-request-documents").upload(path,file,{contentType:file.type||undefined,upsert:false});
          if(up.error)throw up.error;
          const meta=await supabase.from("quote_request_attachments").insert({quote_request_id:req.id,file_name:file.name,file_path:path,content_type:file.type||null,file_size:file.size,uploaded_by:userId});
          if(meta.error)throw meta.error;
        }catch{failed.push(file.name);}
      }
      if(failed.length)sessionStorage.setItem("quoteRequestUploadWarning",`Request created, but these files need to be uploaded again: ${failed.join(", ")}`);
      location.href=`/admin/quote-requests/${req.id}`;
    }catch(err){setMessage(err instanceof Error?err.message:"Unable to create quote request.");setBusy(false);}
  }

  return <div className="newExternalRequestWrap">
    <button className="button gold" type="button" onClick={()=>setOpen(v=>!v)}>{open?"Close":"+ New External Request"}</button>
    {open&&<form className="adminPanel externalRequestForm" onSubmit={submit}>
      <div className="panelHeading"><div><h2>Create request from customer document</h2><p>Use this when a production sends its own requirement sheet by email, WhatsApp, PDF, Excel, or image.</p></div></div>
      <div className="formGrid"><label>Production / Client<input name="company" required/></label><label>Project<input name="project" required/></label></div>
      <div className="formGrid"><label>Contact name<input name="name" required minLength={2}/></label><label>Phone / WhatsApp<input name="phone" required minLength={6}/></label></div>
      <div className="formGrid"><DateTimePicker label="Start" value={start} onChange={setStart}/><DateTimePicker label="Return" value={end} min={start} onChange={setEnd}/></div>
      <label>Original request document(s)<input name="requestFiles" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.doc,.docx,application/pdf,image/*"/></label>
      <label>Internal request note<textarea name="notes" rows={3} placeholder="Optional note about how this request was received"/></label>
      <div className="formActions"><button className="button gold" disabled={busy}>{busy?"Creating Request…":"Create Request & Start Pricing"}</button></div>
      {message&&<div className="errorBox">{message}</div>}
      {busy&&<div className="actionOverlay" role="status"><div className="actionOverlayCard"><span className="loadingSpinner"/><b>Creating customer request…</b><small>Saving the request and attaching the original files.</small></div></div>}
    </form>}
  </div>;
}
