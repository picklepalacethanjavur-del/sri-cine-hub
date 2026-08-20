import {requireStaff} from "@/lib/auth";
import {SubRentalManager} from "./SubRentalManager";

export default async function SubRentalsPage(){
  const {supabase}=await requireStaff();
  const {data,error}=await supabase.from("booking_subrentals").select("*,bookings(booking_code,production_name,project_name,start_at,end_at,status)").order("created_at",{ascending:false});
  return <section className="adminShell"><div className="eyebrow">EXTERNAL EQUIPMENT</div><h1>Sub-Rentals</h1>{error&&<div className="errorBox">{error.message}</div>}<SubRentalManager initialRows={data||[]}/></section>;
}
