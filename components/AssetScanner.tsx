"use client";
import { useEffect, useRef, useState } from "react";
type Props={onCode:(code:string)=>void; title?:string};
export function AssetScanner({onCode,title="Scan equipment QR"}:Props){
 const videoRef=useRef<HTMLVideoElement>(null);
 const [active,setActive]=useState(false); const [manual,setManual]=useState(""); const [msg,setMsg]=useState("");
 useEffect(()=>()=>{const s=videoRef.current?.srcObject as MediaStream|undefined;s?.getTracks().forEach(t=>t.stop())},[]);
 async function start(){
  setMsg("");
  const Detector=(window as any).BarcodeDetector;
  if(!Detector){setMsg("Live QR detection is not available in this browser. Use the QR code field below.");return;}
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
  if(!videoRef.current)return; videoRef.current.srcObject=stream; await videoRef.current.play(); setActive(true);
  const detector=new Detector({formats:["qr_code"]});
  const loop=async()=>{
   if(!videoRef.current||!active&&videoRef.current.srcObject==null)return;
   try{const codes=await detector.detect(videoRef.current);if(codes?.[0]?.rawValue){onCode(codes[0].rawValue);stream.getTracks().forEach(t=>t.stop());setActive(false);return;}}catch{}
   if(stream.active) requestAnimationFrame(loop);
  };requestAnimationFrame(loop);
 }
 function stop(){const s=videoRef.current?.srcObject as MediaStream|undefined;s?.getTracks().forEach(t=>t.stop());setActive(false)}
 return <div className="scannerBox"><div className="scannerHead"><b>{title}</b><button type="button" className="smallButton" onClick={active?stop:start}>{active?"Stop camera":"Open phone camera"}</button></div>
  {active&&<video ref={videoRef} className="scannerVideo" playsInline/>}
  <div className="scannerManual"><input value={manual} onChange={e=>setManual(e.target.value)} placeholder="Scan or enter e.g. SCH-CAM-001"/><button type="button" className="button ghost" onClick={()=>manual.trim()&&onCode(manual.trim())}>Use code</button></div>
  {msg&&<p className="formNote">{msg}</p>}
 </div>
}
