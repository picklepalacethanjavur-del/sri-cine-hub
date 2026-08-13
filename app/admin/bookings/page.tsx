import { redirect } from 'next/navigation'
import { AdminNav } from '@/components/AdminNav'
import { createClient } from '@/lib/supabase/server'
export default async function Bookings(){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/login')
 const {data}=await supabase.from('bookings').select('*,customers(name,company_name),booking_cameras(camera_id,cameras(camera_code,name))').order('start_at',{ascending:false})
 return <section className="adminShell"><div className="eyebrow">LIVE BOOKINGS</div><h1>Reservations & rentals</h1><AdminNav/><div className="adminPanel">{(data||[]).map((b:any)=><div className="bookingRow tall" key={b.id}><div><b>{b.booking_code} · {b.production_name||b.customers?.company_name||b.customers?.name}</b><span>{b.project_name||'Project'} · {new Date(b.start_at).toLocaleString('en-IN')} → {new Date(b.end_at).toLocaleString('en-IN')}</span><span>{(b.booking_cameras||[]).map((x:any)=>x.cameras?.camera_code+' '+x.cameras?.name).join(', ')}</span></div><div className="bookingFinance"><em className={`status ${b.status}`}>{b.status.replaceAll('_',' ')}</em><b>₹{Number(b.quoted_total_inr||0).toLocaleString('en-IN')}</b></div></div>)}</div></section>
}
