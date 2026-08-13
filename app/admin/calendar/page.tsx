import { redirect } from 'next/navigation'
import { AdminNav } from '@/components/AdminNav'
import { createClient } from '@/lib/supabase/server'
export default async function Calendar(){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/login')
 const {data}=await supabase.from('bookings').select('id,booking_code,status,production_name,project_name,start_at,end_at,booking_cameras(cameras(camera_code,name))').not('status','in','("cancelled","closed")').order('start_at')
 return <section className="adminShell"><div className="eyebrow">DATE-BASED AVAILABILITY</div><h1>Booking schedule</h1><AdminNav/><div className="adminPanel">{(data||[]).length?(data||[]).map((b:any)=><div className="calendarItem" key={b.id}><div className="calendarDate"><b>{new Date(b.start_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</b><span>to {new Date(b.end_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</span></div><div><strong>{b.booking_code} · {b.production_name}</strong><p>{b.project_name} · {(b.booking_cameras||[]).map((x:any)=>x.cameras?.camera_code).join(', ')}</p></div><em className={`status ${b.status}`}>{b.status.replaceAll('_',' ')}</em></div>):<p>No scheduled bookings.</p>}</div></section>
}
