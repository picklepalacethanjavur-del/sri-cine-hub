import { redirect } from 'next/navigation'
import { AdminNav } from '@/components/AdminNav'
import { createClient } from '@/lib/supabase/server'
export default async function Inventory(){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/login')
 const {data:cameras}=await supabase.from('cameras').select('*').order('camera_code')
 const {data:accessories}=await supabase.from('accessories').select('*').order('accessory_code')
 return <section className="adminShell"><div className="eyebrow">LIVE INVENTORY</div><h1>Serialized equipment</h1><AdminNav/><div className="adminPanel"><h2>Cameras</h2>{(cameras||[]).map(c=><div className="bookingRow" key={c.id}><div><b>{c.camera_code} · {c.name}</b><span>{c.manufacturer} {c.model} · Serial {c.serial_number||'not entered'} · {c.current_hours||0}h</span></div><em className={`status ${c.status}`}>{c.status}</em></div>)}</div><div className="adminPanel"><h2>Accessories</h2>{(accessories||[]).length?(accessories||[]).map(a=><div className="bookingRow" key={a.id}><div><b>{a.accessory_code} · {a.name}</b><span>{a.category||'Accessory'} · {a.location||'Chennai'}</span></div><em className={`status ${a.status}`}>{a.status}</em></div>):<p>No serialized accessories entered yet.</p>}</div></section>
}
