"use client";
import {useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {DateTimePicker} from "@/components/DateTimePicker";

export function NewBooking({cameras,userId}:{cameras:any[];userId:string}){
  const supabase=createClient();
  const [start,setStart]=useState("");
  const [end,setEnd]=useState("");
  const [selected,setSelected]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function create(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(busy)return;
    if(!start||!end||new Date(end)<=new Date(start)){setMessage("Invalid rental period.");return;}
    setBusy(true);setMessage("");
    try{
      for(const id of selected){
        const {data,error}=await supabase.rpc("camera_is_available",{p_camera_id:id,p_start:new Date(start).toISOString(),p_end:new Date(end).toISOString(),p_exclude_booking:null});
        if(error)throw error;
        if(!data)throw new Error("One selected camera is no longer available.");
      }
      const f=new FormData(e.currentTarget);
      const {data:c,error:customerError}=await supabase.from("customers").insert({name:String(f.get("contact")),company_name:String(f.get("production")),phone:String(f.get("phone"))}).select("id").single();
      if(customerError)throw customerError;
      const code=`BK-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const {data:b,error}=await supabase.from("bookings").insert({booking_code:code,customer_id:c?.id||null,status:"reserved",production_name:String(f.get("production")),project_name:String(f.get("project")),contact_name:String(f.get("contact")),contact_phone:String(f.get("phone")),start_at:new Date(start).toISOString(),end_at:new Date(end).toISOString(),camera_charge_inr:Number(f.get("cameraCharge")||0),other_charges_inr:Number(f.get("other")||0),discount_inr:Number(f.get("discount")||0),created_by:userId}).select("id").single();
      if(error)throw error;
      if(selected.length){
        const assignment=await supabase.from("booking_cameras").insert(selected.map(id=>({booking_id:b.id,camera_id:id})));
        if(assignment.error)throw assignment.error;
      }
      setMessage("Reservation created.");
      setTimeout(()=>location.reload(),500);
    }catch(e){
      setMessage(e instanceof Error?e.message:"Unable to create reservation.");
      setBusy(false);
    }
  }

  return <form className="adminPanel formPanel" onSubmit={create}>
    <h2>New reservation</h2>
    <div className="formGrid"><input name="production" required placeholder="Production / client"/><input name="project" required placeholder="Project"/></div>
    <div className="formGrid"><input name="contact" required placeholder="Contact name"/><input name="phone" required placeholder="Phone"/></div>
    <div className="formGrid"><DateTimePicker label="Start" value={start} onChange={setStart}/><DateTimePicker label="Return" value={end} min={start} onChange={setEnd}/></div>
    <div className="assetChecklist">{cameras.map(c=><label key={c.id}><input type="checkbox" checked={selected.includes(c.id)} onChange={e=>setSelected(e.target.checked?[...selected,c.id]:selected.filter(x=>x!==c.id))}/>{c.camera_code} · {c.name}</label>)}</div>
    <div className="formGrid"><input name="cameraCharge" type="number" placeholder="Camera charge ₹"/><input name="other" type="number" placeholder="Other charges ₹"/></div>
    <input name="discount" type="number" placeholder="Discount ₹"/>
    <button className="button gold" disabled={busy}>{busy?"Creating Reservation…":"Create reservation"}</button>
    {message&&<div className={message.includes("created")?"successBox":"errorBox"}>{message}</div>}
    {busy&&<div className="actionOverlay" role="status" aria-live="polite"><div className="actionOverlayCard"><span className="loadingSpinner"/><b>Creating reservation…</b><small>Checking availability and assigning the selected cameras.</small></div></div>}
  </form>;
}
