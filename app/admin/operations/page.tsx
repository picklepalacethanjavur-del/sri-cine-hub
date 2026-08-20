import {requireStaff} from "@/lib/auth";
import {OperationsManager} from "./OperationsManager";

export default async function Operations({searchParams}:{searchParams:Promise<{booking?:string}>}){
  const query=await searchParams;
  const {supabase,user}=await requireStaff();
  await supabase.rpc("sync_overdue_bookings");
  const {data,error}=await supabase.from("bookings").select(`
    *,
    booking_cameras(id,camera_id,checkout_hours,condition_out,condition_in,cameras(id,camera_code,name,qr_code,current_hours,status)),
    booking_accessories(id,accessory_id,quantity,condition_out,condition_in,accessories(id,accessory_code,name,qr_code,status))
  `).in("status",["reserved","confirmed","preparing","checked_out","overdue"]).order("start_at");
  return <section className="adminShell"><div className="eyebrow">CHAIN OF CUSTODY</div><h1>Checkout / Return</h1>{error&&<div className="errorBox">{error.message}</div>}<OperationsManager bookings={data||[]} userId={user.id} initialBookingId={query.booking||""}/></section>;
}
