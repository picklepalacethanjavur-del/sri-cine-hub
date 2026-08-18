"use client";
import Link from "next/link";
import {useState} from "react";

export function DocumentActions({editHref,closeHref,downloadHref,fileName,whatsappText,children}:{editHref?:string;closeHref?:string;downloadHref:string;fileName:string;whatsappText:string;children?:React.ReactNode}){
  const [sharing,setSharing]=useState(false);const [message,setMessage]=useState("");
  async function getPdfFile(){const res=await fetch(downloadHref,{credentials:"same-origin"});if(!res.ok)throw new Error(`PDF download failed (${res.status})`);const blob=await res.blob();if(!blob.size)throw new Error("Generated PDF is empty");return new File([blob],fileName,{type:"application/pdf"});}
  async function share(){setSharing(true);setMessage("");try{const file=await getPdfFile();if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:fileName,text:whatsappText,files:[file]});setMessage("Share sheet opened.");}else{const url=URL.createObjectURL(file);const a=document.createElement("a");a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage("Sharing files is not supported in this browser, so the PDF was downloaded instead.");}}catch(err){setMessage(err instanceof Error?err.message:"Unable to prepare the PDF for sharing.");}finally{setSharing(false);}}
  function whatsapp(){setMessage("WhatsApp message opened. Attach the downloaded PDF manually for now.");window.open(`https://wa.me/?text=${encodeURIComponent(whatsappText)}`,"_blank","noopener,noreferrer");}
  return <><div className="universalDocumentActions printHide">
    <div className="documentShareActions"><button className="button ghost" type="button" onClick={()=>history.length>1?history.back():location.assign(closeHref||"/admin")}>← Back</button>{editHref&&<Link className="button ghost" href={editHref}>Edit</Link>}<button className="button ghost" type="button" onClick={()=>window.print()}>Print / Save PDF</button><a className="button ghost" href={downloadHref} download={fileName}>Download PDF</a><button className="button ghost" type="button" onClick={share} disabled={sharing}>{sharing?"Preparing PDF…":"Share"}</button><button className="button whatsappButton" type="button" onClick={whatsapp}>WhatsApp</button>{closeHref&&<Link className="button ghost closeDocumentButton" href={closeHref} aria-label="Close document">✕ Close</Link>}</div>
    {children&&<div className="documentWorkflowActions">{children}</div>}
  </div>{message&&<div className={message.toLowerCase().includes("failed")||message.toLowerCase().includes("unable")||message.toLowerCase().includes("empty")?"errorBox printHide":"successBox printHide"} role="status">{message}</div>}</>;
}
