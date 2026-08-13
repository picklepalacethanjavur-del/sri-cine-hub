import { redirect } from 'next/navigation'
import { AdminNav } from '@/components/AdminNav'
import { SignOutButton } from '@/components/SignOutButton'
import { createClient } from '@/lib/supabase/server'

export default async function Admin(){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/login')
 const [{data:cameras},{data:bookings},{data:profile},{data:quotes}] = await Promise.all([
   supabase.from('cameras').select('id,camera_code,name,status,current_hours').order('camera_code'),
   supabase.from('bookings').select('id,booking_code,status,production_name,project_name,start_at,end_at,quoted_total_inr,amount_received_inr').order('start_at',{ascending:false}).limit(10),
   supabase.from('profiles').select('full_name,role').eq('id',user.id).single(),
   supabase.from('quote_requests').select('id,status').eq('status','new')
 ])
 const cams=cameras||[], books=bookings||[]; const out=cams.filter(c=>c.status==='out').length, available=cams.filter(c=>c.status==='available').length
 const balance=books.reduce((n,b)=>n+Number(b.quoted_total_inr||0)-Number(b.amount_received_inr||0),0)
 return <section className="adminShell"><div className="adminTitle"><div><div className="eyebrow">LIVE SUPABASE OPERATIONS</div><h1>Rental Dashboard</h1><p>{profile?.full_name||user.email}</p></div><div><span className="roleBadge">{profile?.role||'staff'}</span><SignOutButton/></div></div><AdminNav/>
 <div className="metricGrid"><div className="metric"><span>Available</span><b>{available}</b></div><div className="metric"><span>Out</span><b>{out}</b></div><div className="metric"><span>New quote requests</span><b>{quotes?.length||0}</b></div><div className="metric"><span>Balance due</span><b>₹{balance.toLocaleString('en-IN')}</b></div></div>
 <div className="adminGrid"><div className="adminPanel"><h2>Recent bookings</h2>{books.length?books.map(b=><div className="bookingRow" key={b.id}><div><b>{b.booking_code}</b><span>{b.production_name||'Client'} · {b.project_name||'Project'}</span></div><em className={`status ${b.status}`}>{b.status.replaceAll('_',' ')}</em></div>):<p>No bookings yet.</p>}</div><div className="adminPanel"><h2>Fleet now</h2>{cams.map(c=><div className="bookingRow" key={c.id}><div><b>{c.camera_code} · {c.name}</b><span>{c.current_hours||0} verified hours</span></div><em className={`status ${c.status}`}>{c.status}</em></div>)}</div></div>
 </section>
}
