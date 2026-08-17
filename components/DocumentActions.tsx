"use client";
import Link from "next/link";
import {useState} from "react";

export function DocumentActions({editHref,downloadHref,fileName,whatsappText,children}:{editHref?:string;downloadHref:string;fileName:string;whatsappText:string;children?:React.ReactNode}){
 const [sharing,setSharing]=useState(false);
 async function share(){setSharing(true);try{const res=await fetch(downloadHref);if(!res.ok)throw new Error("PDF download failed");const blob=await res.blob();const file=new File([blob],fileName,{type:"application/pdf"});if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:fileName,text:whatsappText,files:[file]});}else{const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fileName;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}}catch(e){console.error(e);}finally{setSharing(false);}}
 function whatsapp(){window.open(`https://wa.me/?text=${encodeURIComponent(whatsappText)}`,"_blank","noopener,noreferrer");}
 return <div className="universalDocumentActions printHide">
   <div className="documentShareActions">{editHref&&<Link className="button ghost" href={editHref}>← Edit</Link>}<button className="button ghost" type="button" onClick={()=>window.print()}>Print / Save PDF</button><a className="button ghost" href={downloadHref} download={fileName}>Download PDF</a><button className="button ghost" type="button" onClick={share} disabled={sharing}>{sharing?"Preparing…":"Share"}</button><button className="button whatsappButton" type="button" onClick={whatsapp}>WhatsApp</button></div>
   {children&&<div className="documentWorkflowActions">{children}</div>}
 </div>;
}
