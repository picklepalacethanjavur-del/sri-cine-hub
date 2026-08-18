"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "@/lib/supabase/client";

export type RequestAttachment={id:string;file_name:string;file_path:string;content_type:string|null;file_size:number|null;created_at:string};

function sizeLabel(bytes:number|null){
  if(!bytes)return "";
  if(bytes<1024)return `${bytes} B`;
  if(bytes<1024*1024)return `${Math.round(bytes/1024)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
}

export function RequestDocuments({requestId,attachments,userId:_userId,compact=false}:{requestId:string;attachments:RequestAttachment[];userId:string;compact?:boolean}){
  const supabase=createClient();
  const router=useRouter();
  const inputRef=useRef<HTMLInputElement|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function assertStaffSession(){
    const {data:{user},error}=await supabase.auth.getUser();
    if(error||!user)throw new Error("Your staff session expired. Sign in again before changing request documents.");
    const {data:allowed,error:roleError}=await supabase.rpc("is_active_staff");
    if(roleError)throw roleError;
    if(!allowed)throw new Error("Your account does not currently have active staff access.");
  }

  async function upload(files:FileList|null){
    if(!files?.length||busy)return;
    const selected=Array.from(files); // capture before input changes / awaits
    setBusy(true);setMessage("");
    try{
      await assertStaffSession();
      for(const file of selected){
        if(file.size>25*1024*1024)throw new Error(`${file.name} is larger than 25 MB.`);
        const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
        const path=`${requestId}/${Date.now()}-${crypto.randomUUID().slice(0,8)}-${safe}`;
        const up=await supabase.storage.from("quote-request-documents").upload(path,file,{contentType:file.type||undefined,upsert:false});
        if(up.error)throw up.error;
        const meta=await supabase.rpc("staff_add_quote_request_attachment",{
          p_quote_request_id:requestId,
          p_file_name:file.name,
          p_file_path:path,
          p_content_type:file.type||null,
          p_file_size:file.size,
        });
        if(meta.error){await supabase.storage.from("quote-request-documents").remove([path]);throw meta.error;}
      }
      setMessage("Request document uploaded.");
      if(inputRef.current)inputRef.current.value="";
      router.refresh();
    }catch(e){
      const raw=e instanceof Error?e.message:"Unable to upload document.";
      setMessage(raw.includes("row-level security")?"Staff authorization failed while uploading. Sign out and back in, then retry.":raw);
    } finally {setBusy(false);}
  }

  async function view(a:RequestAttachment){
    setMessage("");
    const {data,error}=await supabase.storage.from("quote-request-documents").createSignedUrl(a.file_path,600);
    if(error||!data?.signedUrl){setMessage(error?.message||"Unable to open document.");return;}
    window.open(data.signedUrl,"_blank","noopener,noreferrer");
  }

  async function remove(a:RequestAttachment){
    if(busy||!confirm(`Remove ${a.file_name} from this request?`))return;
    setBusy(true);setMessage("");
    try{
      await assertStaffSession();
      // Delete metadata first via role-checked RPC; if storage deletion fails the orphan can be cleaned safely later.
      const meta=await supabase.rpc("staff_delete_quote_request_attachment",{p_attachment_id:a.id});
      if(meta.error)throw meta.error;
      const storage=await supabase.storage.from("quote-request-documents").remove([a.file_path]);
      if(storage.error)throw storage.error;
      setMessage("Request document removed.");
      router.refresh();
    }catch(e){
      const raw=e instanceof Error?e.message:"Unable to remove document.";
      setMessage(raw.includes("row-level security")?"Staff authorization failed while removing the document. Sign out and back in, then retry.":raw);
    } finally {setBusy(false);}
  }

  return <div className={`adminPanel requestDocuments ${compact?"compact":""}`}>
    <div className="requestDocumentsHead">
      <div><h2>Customer Request Documents</h2><p>Keep the original PDF, image, spreadsheet, or document attached to this quote request.</p></div>
      <button className="button ghost uploadButton" type="button" disabled={busy} onClick={()=>inputRef.current?.click()}>{busy?"Working…":"+ Upload Request"}</button>
      <input ref={inputRef} style={{display:"none"}} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.doc,.docx,application/pdf,image/*" onChange={e=>void upload(e.target.files)} disabled={busy} aria-label="Choose customer request documents"/>
    </div>
    {attachments.length?<div className="requestDocumentList">{attachments.map(a=><div className="requestDocumentRow" key={a.id}>
      <div className="documentIcon">DOC</div>
      <div><b>{a.file_name}</b><span>{sizeLabel(a.file_size)}{a.created_at?` · ${new Date(a.created_at).toLocaleString("en-IN")}`:""}</span></div>
      <button type="button" className="button ghost" onClick={()=>void view(a)}>View</button>
      <button type="button" className="iconButton danger" onClick={()=>void remove(a)} aria-label={`Remove ${a.file_name}`}>×</button>
    </div>)}</div>:<div className="emptyDocumentState">No original request document attached yet.</div>}
    {message&&<div className={message.includes("uploaded")||message.includes("removed")?"successBox":"errorBox"}>{message}</div>}
  </div>;
}
