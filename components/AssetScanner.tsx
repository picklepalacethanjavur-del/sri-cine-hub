"use client";
import { useEffect, useRef, useState } from "react";

export type ScanMethod="qr"|"manual";
type Props={onCode:(code:string,method:ScanMethod)=>void; title?:string};

export function normalizeAssetCode(raw:string){
  const value=(raw||"").trim().toUpperCase();
  const match=value.match(/SCH-(?:CAM|ACC)-[A-Z0-9-]+/i);
  return (match?.[0]||value).trim().toUpperCase();
}

export function AssetScanner({onCode,title="Scan equipment QR"}:Props){
  const videoRef=useRef<HTMLVideoElement>(null);
  const [active,setActive]=useState(false);
  const [manual,setManual]=useState("");
  const [msg,setMsg]=useState("");

  useEffect(()=>()=>{const s=videoRef.current?.srcObject as MediaStream|undefined;s?.getTracks().forEach(t=>t.stop())},[]);

  async function start(){
    setMsg("");
    const Detector=(window as any).BarcodeDetector;
    if(!Detector){
      setMsg("Live QR detection is not available in this browser. Enter the equipment code below.");
      return;
    }
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
      if(!videoRef.current)return;
      videoRef.current.srcObject=stream;
      await videoRef.current.play();
      setActive(true);
      const detector=new Detector({formats:["qr_code"]});
      const loop=async()=>{
        if(!videoRef.current||(!active&&videoRef.current.srcObject==null))return;
        try{
          const codes=await detector.detect(videoRef.current);
          if(codes?.[0]?.rawValue){
            const code=normalizeAssetCode(codes[0].rawValue);
            onCode(code,"qr");
            setMsg(`Scanned ${code}`);
            stream.getTracks().forEach(t=>t.stop());
            setActive(false);
            return;
          }
        }catch{}
        if(stream.active) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }catch(e){
      setMsg(e instanceof Error?e.message:"Unable to open camera. Enter the equipment code below.");
    }
  }

  function stop(){
    const s=videoRef.current?.srcObject as MediaStream|undefined;
    s?.getTracks().forEach(t=>t.stop());
    setActive(false);
  }

  function useManual(){
    const code=normalizeAssetCode(manual);
    if(!code)return;
    onCode(code,"manual");
    setMsg(`Entered ${code}`);
    setManual("");
  }

  return <div className="scannerBox">
    <div className="scannerHead">
      <b>{title}</b>
      <button type="button" className="smallButton" onClick={active?stop:start}>{active?"Stop camera":"Open phone camera"}</button>
    </div>
    {active&&<video ref={videoRef} className="scannerVideo" playsInline/>}
    <div className="scannerManual">
      <input
        value={manual}
        onChange={e=>setManual(e.target.value)}
        onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();useManual();}}}
        placeholder="Enter e.g. SCH-CAM-001"
        autoCapitalize="characters"
        autoCorrect="off"
      />
      <button type="button" className="button ghost" onClick={useManual}>Use code</button>
    </div>
    {msg&&<p className="formNote">{msg}</p>}
  </div>;
}
