import { requireStaff } from "@/lib/auth";
import { OperationsManager } from "@/app/admin/operations/OperationsManager";

export default async function StudioOps({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  const query = await searchParams;
  const { supabase, user } = await requireStaff();
  await supabase.rpc("sync_overdue_bookings");
  const { data } = await supabase.from("bookings").select(`
    *,
    booking_cameras(id,camera_id,checkout_hours,condition_out,condition_in,cameras(id,camera_code,name,qr_code,current_hours,status)),
    booking_accessories(id,accessory_id,quantity,condition_out,condition_in,accessories(id,accessory_code,name,qr_code,status))
  `).in("status", ["reserved","confirmed","preparing","checked_out","overdue"]).order("start_at");

  return (
    <div className="studioPage studioOpsPage">
      <div className="studioPageHeader">
        <p className="studioEyebrow">WAREHOUSE</p>
        <h1 className="studioH1">Checkout / Return</h1>
      </div>
      <OperationsManager bookings={data || []} userId={user.id} initialBookingId={query.booking || ""} />
    </div>
  );
}
