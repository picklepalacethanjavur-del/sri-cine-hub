import { AdminNav } from "@/components/AdminNav";
import { SignOutButton } from "@/components/SignOutButton";
import { requireStaff } from "@/lib/auth";
export default async function Admin(){
 const {supabase,user,profile}=await requireStaff();
 await supabase.rpc("sync_overdue_bookings");
 const [{data:cameras},{data:bookings},{data:quotes},{data:receipts}]=await Promise.all([
  supabase.from("cameras").select("id,status"),supabase.from("bookings").select("id,status,quoted_total_inr,amount_received_inr"),
  supabase.from("quote_requests").select("id,status").eq("status","new"),supabase.from("receipts").select("id")
 ]);
 const cams=cameras||[], books=bookings||[];
 return <section className="adminShell">
  <div className="adminTitle"><div><div className="eyebrow">SRI CINE HUB OPERATIONS</div><h1>Rental Dashboard</h1><p>{profile.full_name||user.email}</p></div><div><span className="roleBadge">{profile.role}</span><SignOutButton/></div></div>
  <AdminNav/>
  <div className="metricGrid">
   <div className="metric"><span>Available</span><b>{cams.filter(c=>c.status==="available").length}</b></div>
   <div className="metric"><span>Out</span><b>{cams.filter(c=>c.status==="out").length}</b></div>
   <div className="metric"><span>Overdue</span><b>{books.filter(b=>b.status==="overdue").length}</b></div>
   <div className="metric"><span>Quote requests</span><b>{quotes?.length||0}</b></div>
   <div className="metric"><span>Receipts</span><b>{receipts?.length||0}</b></div>
  </div>
  <div className="adminGrid"><div className="adminPanel"><h2>P1 workflow</h2><p>Quote → Reservation → QR checkout → condition/photo proof → return → receipt.</p></div>
  <div className="adminPanel"><h2>RFID ready</h2><p>Every camera/accessory has a QR code and RFID tag field. RFID bulk scanning will be added in P2 without changing the asset model.</p></div></div>
 </section>
}
