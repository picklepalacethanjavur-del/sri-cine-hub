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

export function RequestDocuments({requestId,attachments,userId,compact=false}:{requestId:string;attachments:RequestAttachment[];userId:string;compact?:boolean}){
  const supabase=createClient();
  const router=useRouter();
  const inputRef=useRef<HTMLInputElement|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function upload(files:FileList|null){
    if(!files?.length||busy)return;
    setBusy(true);setMessage("");
    try{
      for(const file of Array.from(files)){
        if(file.size>25*1024*1024)throw new Error(`${file.name} is larger than 25 MB.`);
        const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
        const path=`${requestId}/${Date.now()}-${crypto.randomUUID().slice(0,8)}-${safe}`;
        const up=await supabase.storage.from("quote-request-documents").upload(path,file,{contentType:file.type||undefined,upsert:false});
        if(up.error)throw up.error;
        const meta=await supabase.from("quote_request_attachments").insert({quote_request_id:requestId,file_name:file.name,file_path:path,content_type:file.type||null,file_size:file.size,uploaded_by:userId});
        if(meta.error){await supabase.storage.from("quote-request-documents").remove([path]);throw meta.error;}
      }
      setMessage("Request document uploaded.");
      if(inputRef.current)inputRef.current.value="";
      router.refresh();
    }catch(e){setMessage(e instanceof Error?e.message:"Unable to upload document.");}
    finally{setBusy(false);}
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
      const storage=await supabase.storage.from("quote-request-documents").remove([a.file_path]);
      if(storage.error)throw storage.error;
      const db=await supabase.from("quote_request_attachments").delete().eq("id",a.id);
      if(db.error)throw db.error;
      router.refresh();
    }catch(e){setMessage(e instanceof Error?e.message:"Unable to remove document.");}
    finally{setBusy(false);}
  }

  return <div className={`adminPanel requestDocuments ${compact?"compact":""}`}>
    <div className="requestDocumentsHead">
      <div><h2>Customer Request Documents</h2><p>Keep the original PDF, image, spreadsheet, or document attached to this quote request.</p></div>
      <label className="button ghost uploadButton">{busy?"Uploading…":"+ Upload Request"}<input ref={inputRef} hidden type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.doc,.docx,application/pdf,image/*" onChange={e=>void upload(e.target.files)} disabled={busy}/></label>
    </div>
    {attachments.length?<div className="requestDocumentList">{attachments.map(a=><div className="requestDocumentRow" key={a.id}>
      <div className="documentIcon">DOC</div>
      <div><b>{a.file_name}</b><span>{sizeLabel(a.file_size)}{a.created_at?` · ${new Date(a.created_at).toLocaleString("en-IN")}`:""}</span></div>
      <button type="button" className="button ghost" onClick={()=>void view(a)}>View</button>
      <button type="button" className="iconButton danger" onClick={()=>void remove(a)} aria-label={`Remove ${a.file_name}`}>×</button>
    </div>)}</div>:<div className="emptyDocumentState">No original request document attached yet.</div>}
    {message&&<div className={message.includes("uploaded")?"successBox":"errorBox"}>{message}</div>}
  </div>;
}
