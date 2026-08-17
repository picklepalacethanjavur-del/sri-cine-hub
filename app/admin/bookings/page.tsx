import Link from "next/link";
import {AdminNav} from "@/components/AdminNav";
import {requireStaff} from "@/lib/auth";
import {NewBooking} from "./NewBooking";

export default async function Bookings(){
  const {supabase,user}=await requireStaff();
  await supabase.rpc("sync_overdue_bookings");
  const [{data:books},{data:cameras}]=await Promise.all([
    supabase.from("bookings").select("*,customers(name,company_name),booking_cameras(cameras(camera_code,name)),booking_subrentals(id,description,status)").order("start_at",{ascending:false}),
    supabase.from("cameras").select("id,camera_code,name").neq("status","retired").order("camera_code")
  ]);
  return <section className="adminShell"><div className="eyebrow">RESERVATIONS</div><h1>Bookings</h1><AdminNav/><NewBooking cameras={cameras||[]} userId={user.id}/><div className="adminPanel"><div className="panelHeading"><div><h2>Booking history</h2><p>Accepted external rental requirements appear in the Sub-Rentals checklist.</p></div><Link className="button ghost" href="/admin/sub-rentals">Open Sub-Rentals</Link></div>{(books||[]).map((b:any)=>{const ext=b.booking_subrentals||[];const pending=ext.filter((x:any)=>!["confirmed","received","returned","cancelled"].includes(x.status)).length;return <div className="bookingRow tall" key={b.id}><div><b>{b.booking_code} · {b.production_name||b.customers?.company_name||b.customers?.name}</b><span>{b.project_name} · {new Date(b.start_at).toLocaleString("en-IN")} → {new Date(b.end_at).toLocaleString("en-IN")}</span><span>{(b.booking_cameras||[]).map((x:any)=>x.cameras?.camera_code).filter(Boolean).join(", ")}</span>{ext.length>0&&<span className={pending?"externalBookingWarning":"externalBookingOk"}>External equipment: {ext.length} · {pending?`${pending} need sourcing`:"all confirmed/handled"}</span>}</div><em className={`status ${b.status}`}>{b.status.replaceAll("_"," ")}</em></div>})}</div></section>;
}
