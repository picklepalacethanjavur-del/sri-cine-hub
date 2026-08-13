"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Camera = {camera_id:string;camera_code:string;name:string;manufacturer:string|null;model:string|null;image_url:string|null;available:boolean}

export default function QuoteForm(){
 const [cameras,setCameras]=useState<Camera[]>([]), [selected,setSelected]=useState<string[]>([])
 const [loading,setLoading]=useState(false), [message,setMessage]=useState(''), [start,setStart]=useState(''), [end,setEnd]=useState('')
 const supabase=createClient()
 async function availability(nextStart=start,nextEnd=end){
   if(!nextStart||!nextEnd) return
   setLoading(true);setMessage('')
   const {data,error}=await supabase.rpc('public_camera_availability',{p_start:new Date(nextStart).toISOString(),p_end:new Date(nextEnd).toISOString()})
   if(error) setMessage(error.message); else {setCameras((data||[]) as Camera[]);setSelected([])}
   setLoading(false)
 }
 async function submit(e:React.FormEvent<HTMLFormElement>){
   e.preventDefault();setLoading(true);setMessage('')
   const f=new FormData(e.currentTarget)
   const {data,error}=await supabase.from('quote_requests').insert({
     name:String(f.get('name')||''), company_name:String(f.get('client')||''), phone:String(f.get('phone')||''),
     project_name:String(f.get('project')||''), start_at:new Date(start).toISOString(), end_at:new Date(end).toISOString(),
     requested_camera_ids:selected, notes:String(f.get('notes')||'')
   }).select('request_code').single()
   if(error) setMessage(error.message); else {setMessage(`Request ${data.request_code} received. Sri Cine Hub will confirm availability and pricing.`);e.currentTarget.reset();setSelected([]);setCameras([]);setStart('');setEnd('')}
   setLoading(false)
 }
 return <form className="quoteForm" onSubmit={submit}>
  <div className="formGrid"><label>Production / Client *<input required name="client"/></label><label>Project *<input required name="project"/></label></div>
  <div className="formGrid"><label>Start date & time *<input required type="datetime-local" value={start} onChange={e=>{setStart(e.target.value);availability(e.target.value,end)}}/></label><label>Return date & time *<input required type="datetime-local" value={end} onChange={e=>{setEnd(e.target.value);availability(start,e.target.value)}}/></label></div>
  <div className="availabilityBox"><b>Camera availability</b>{loading&&<p>Checking…</p>}{!loading&&cameras.length===0&&<p className="formNote">Choose start and return dates to check serialized camera availability.</p>}{cameras.map(c=><label key={c.camera_id} className={`availabilityRow ${c.available?'available':'unavailable'}`}><input type="checkbox" disabled={!c.available} checked={selected.includes(c.camera_id)} onChange={e=>setSelected(e.target.checked?[...selected,c.camera_id]:selected.filter(x=>x!==c.camera_id))}/><span><strong>{c.camera_code} · {c.name}</strong><small>{c.available?'Available':'Unavailable for selected dates'}</small></span></label>)}</div>
  <div className="formGrid"><label>Contact name *<input required name="name"/></label><label>Phone / WhatsApp *<input required name="phone"/></label></div>
  <label>Additional package requirements<textarea name="notes" rows={5} placeholder="Lenses, lights, grip, crew, transport, genset, post-production…"/></label>
  <button className="button gold" disabled={loading} type="submit">Request availability & quote</button>
  {message&&<div className={message.startsWith('Request')?'successBox':'errorBox'}>{message}</div>}
  <p className="formNote">No payment is collected here. Staff reviews and confirms the reservation.</p>
 </form>
}
