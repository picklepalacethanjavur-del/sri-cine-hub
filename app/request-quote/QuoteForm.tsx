"use client";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DateTimePicker } from "@/components/DateTimePicker";

type Camera={camera_id:string;camera_code:string;name:string;manufacturer:string|null;model:string|null;image_url:string|null;available:boolean};

function localMin(){
  const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
  return d.toISOString().slice(0,16);
}
export default function QuoteForm(){
  const [cameras,setCameras]=useState<Camera[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [start,setStart]=useState("");
  const [end,setEnd]=useState("");
  const minDate=useMemo(()=>localMin(),[]);
  const supabase=createClient();

  async function availability(s=start,e=end){
    if(!s||!e) return setCameras([]);
    if(new Date(e)<=new Date(s)){setCameras([]);setMessage("Return date/time must be after start.");return;}
    setLoading(true);setMessage("");
    const {data,error}=await supabase.rpc("public_camera_availability",{p_start:new Date(s).toISOString(),p_end:new Date(e).toISOString()});
    if(error)setMessage(error.message);else{setCameras((data||[]) as Camera[]);setSelected([]);}
    setLoading(false);
  }
  async function submit(ev:React.FormEvent<HTMLFormElement>){
    ev.preventDefault();
    if(!start||!end||new Date(end)<=new Date(start)) return setMessage("Choose a valid rental period.");
    setLoading(true);setMessage("");
    const f=new FormData(ev.currentTarget);
    const {data,error}=await supabase.rpc("submit_quote_request",{
      p_name:String(f.get("name")||""),p_company_name:String(f.get("client")||""),
      p_phone:String(f.get("phone")||""),p_project_name:String(f.get("project")||""),
      p_start:new Date(start).toISOString(),p_end:new Date(end).toISOString(),
      p_requested_camera_ids:selected,p_notes:String(f.get("notes")||"")
    });
    if(error)setMessage(error.message);
    else{setMessage(`Request ${data} received. Sri Cine Hub will confirm availability and pricing.`);ev.currentTarget.reset();setSelected([]);setCameras([]);setStart("");setEnd("");}
    setLoading(false);
  }
  return <form className="quoteForm" onSubmit={submit}>
    <div className="formGrid"><label>Production / Client *<input required name="client"/></label><label>Project *<input required name="project"/></label></div>
    <div className="formGrid">
      <DateTimePicker label="Start" value={start} min={minDate} onChange={v=>{setStart(v);availability(v,end)}}/>
      <DateTimePicker label="Return" value={end} min={start||minDate} onChange={v=>{setEnd(v);availability(start,v)}}/>
    </div>
    <div className="availabilityBox"><b>Camera availability</b>
      {!cameras.length&&<p className="formNote">Choose start and return dates. The calendar opens when you tap the date field.</p>}
      {cameras.map(c=><label key={c.camera_id} className={`availabilityRow ${c.available?"available":"unavailable"}`}>
        <input type="checkbox" disabled={!c.available} checked={selected.includes(c.camera_id)}
          onChange={e=>setSelected(e.target.checked?[...selected,c.camera_id]:selected.filter(x=>x!==c.camera_id))}/>
        <span><strong>{c.camera_code} · {c.name}</strong><small>{c.available?"Available":"Unavailable"}</small></span>
      </label>)}
    </div>
    <div className="formGrid"><label>Contact name *<input required name="name" minLength={2}/></label><label>Phone / WhatsApp *<input required name="phone" minLength={6} inputMode="tel"/></label></div>
    <label>Package requirements<textarea name="notes" rows={5} placeholder="Lenses, lights, grip, crew, transport, genset, post-production…"/></label>
    <button className="button gold" disabled={loading}>{loading?"Submitting…":"Request availability & quote"}</button>
    {message&&<div className={message.startsWith("Request")?"successBox":"errorBox"}>{message}</div>}
    <p className="formNote">Rates are internal. No payment is collected here.</p>
  </form>;
}
