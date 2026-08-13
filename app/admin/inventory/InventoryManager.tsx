"use client";
import { useState } from "react"; import { createClient } from "@/lib/supabase/client";
export function InventoryManager({cameras,accessories}:{cameras:any[];accessories:any[]}){
 const supabase=createClient(); const [msg,setMsg]=useState("");
 async function addCamera(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const code=String(f.get("code")).trim().toUpperCase();
  const {error}=await supabase.from("cameras").insert({camera_code:code,qr_code:`SCH-${code}`,name:String(f.get("name")),manufacturer:String(f.get("manufacturer")||""),model:String(f.get("model")||""),serial_number:String(f.get("serial")||"")||null,current_hours:Number(f.get("hours")||0),location:String(f.get("location")||"Chennai")});
  if(error)setMsg(error.message);else location.reload();
 }
 async function addAccessory(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const code=String(f.get("code")).trim().toUpperCase();
  const {error}=await supabase.from("accessories").insert({accessory_code:code,qr_code:`SCH-${code}`,name:String(f.get("name")),category:String(f.get("category")||"Accessory"),serial_number:String(f.get("serial")||"")||null,location:String(f.get("location")||"Chennai")});
  if(error)setMsg(error.message);else location.reload();
 }
 return <><div className="adminGrid">
  <form className="adminPanel formPanel" onSubmit={addCamera}><h2>Add camera</h2><input name="code" required placeholder="CAM-001"/><input name="name" required placeholder="ARRI ALEXA 35"/><div className="formGrid"><input name="manufacturer" placeholder="ARRI"/><input name="model" placeholder="ALEXA 35"/></div><input name="serial" placeholder="Serial number"/><div className="formGrid"><input name="hours" type="number" step=".1" placeholder="Current hours"/><input name="location" defaultValue="Chennai"/></div><button className="button gold">Add camera + QR</button></form>
  <form className="adminPanel formPanel" onSubmit={addAccessory}><h2>Add accessory</h2><input name="code" required placeholder="BAT-001"/><input name="name" required placeholder="B-Mount Battery"/><div className="formGrid"><input name="category" placeholder="Battery"/><input name="serial" placeholder="Serial"/></div><input name="location" defaultValue="Chennai"/><button className="button gold">Add accessory + QR</button></form>
 </div>{msg&&<div className="errorBox">{msg}</div>}
 <div className="adminPanel"><h2>QR / RFID registry</h2>{[...cameras,...accessories].map(a=><div className="bookingRow" key={a.id}><div><b>{a.camera_code||a.accessory_code} · {a.name}</b><span>QR: {a.qr_code} · RFID: {a.rfid_tag||"not assigned"}</span></div><em className={`status ${a.status}`}>{a.status}</em></div>)}</div></>
}
