
export type PremiumReceiptLine={
  section:string;
  description:string;
  assetRef:string;
  quantity:number;
  days:number;
  rate:number;
  amount:number;
};

export type PremiumReceiptPayment={
  id:string;
  date:string;
  method:string;
  reference:string;
  amount:number;
};

export type PremiumReceiptData={
  id:string;
  receiptCode:string;
  issuedAt:string;
  status:"PAID"|"PARTIALLY PAID"|"BALANCE DUE";
  customer:{
    name:string;
    company:string;
    phone:string;
    email:string;
  };
  rental:{
    bookingCode:string;
    quotationCode:string;
    project:string;
    production:string;
    pickup:string;
    returnAt:string;
    duration:string;
    pickupLocation:string;
    returnLocation:string;
    operator:string;
  };
  lines:PremiumReceiptLine[];
  charges:{
    itemSubtotal:number|null;
    quotationDiscount:number;
    quotationTax:number;
    quotationOther:number;
    rentalTotal:number;
    damage:number;
    late:number;
    additional:number;
    receiptDiscount:number;
    grandTotal:number;
  };
  payments:PremiumReceiptPayment[];
  paid:number;
  balance:number;
  notes:string;
};

const n=(v:any)=>Number(v||0);
const dateTime=(v:any)=>v?new Date(v).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"—";
const duration=(start:any,end:any)=>{
  if(!start||!end)return "—";
  const ms=Math.max(0,new Date(end).getTime()-new Date(start).getTime());
  const days=Math.max(1,Math.ceil(ms/86400000));
  return `${days} day${days===1?"":"s"}`;
};

export async function loadPremiumReceiptData(supabase:any,id:string):Promise<PremiumReceiptData|null>{
  const {data:r,error}=await supabase.from("receipts").select(`
    *,
    bookings(*),
    customers(name,company_name,phone,email)
  `).eq("id",id).single();
  if(error||!r)return null;

  const booking=r.bookings||{};
  const [{data:paymentsRaw},{data:request},{data:cameras},{data:accessories},{data:subrentals}]=await Promise.all([
    supabase.from("payments").select("id,amount_inr,method,reference,received_at,transaction_type,status,reversed_payment_id").eq("booking_id",r.booking_id).order("received_at",{ascending:true}),
    supabase.from("quote_requests").select("id,request_code").eq("converted_booking_id",r.booking_id).maybeSingle(),
    supabase.from("booking_cameras").select("camera_id,daily_rate_inr,cameras(id,camera_code,name,serial_number,catalog_item_id)").eq("booking_id",r.booking_id),
    supabase.from("booking_accessories").select("accessory_id,quantity,daily_rate_inr,accessories(id,accessory_code,name,serial_number,catalog_item_id)").eq("booking_id",r.booking_id),
    supabase.from("booking_subrentals").select("*").eq("booking_id",r.booking_id)
  ]);

  let quotation:any=null;
  let qitems:any[]=[];
  if(request?.id){
    const qSelect="id,quotation_code,status,subtotal_inr,discount_inr,tax_inr,other_charges_inr,total_inr";
    let {data:q}=await supabase.from("quotations").select(qSelect).eq("quote_request_id",request.id).eq("status","converted").order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(!q){
      const fallback=await supabase.from("quotations").select(qSelect).eq("quote_request_id",request.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
      q=fallback.data||null;
    }
    quotation=q||null;
    if(q?.id){
      const {data:items}=await supabase.from("quotation_items").select("id,item_type,item_id,catalog_item_id,section_name,description,quantity,rental_days,unit_rate_inr,line_total_inr,source_type,sort_order").eq("quotation_id",q.id).order("sort_order",{ascending:true});
      qitems=items||[];
    }
  }

  const cameraPool=[...(cameras||[])];
  const accessoryPool=[...(accessories||[])];
  const usedCameras=new Set<string>();
  const usedAccessories=new Set<string>();

  function refFor(item:any){
    if(item.source_type!=="own")return "—";
    if(item.item_type==="camera"){
      let row=cameraPool.find((x:any)=>!usedCameras.has(x.camera_id)&&(
        (item.item_id&&x.camera_id===item.item_id)||
        (item.catalog_item_id&&x.cameras?.catalog_item_id===item.catalog_item_id)
      ));
      if(!row)row=cameraPool.find((x:any)=>!usedCameras.has(x.camera_id));
      if(row){usedCameras.add(row.camera_id);return row.cameras?.serial_number||row.cameras?.camera_code||"—";}
    }
    if(item.item_type==="accessory"){
      let row=accessoryPool.find((x:any)=>!usedAccessories.has(x.accessory_id)&&(
        (item.item_id&&x.accessory_id===item.item_id)||
        (item.catalog_item_id&&x.accessories?.catalog_item_id===item.catalog_item_id)
      ));
      if(!row)row=accessoryPool.find((x:any)=>!usedAccessories.has(x.accessory_id));
      if(row){usedAccessories.add(row.accessory_id);return row.accessories?.serial_number||row.accessories?.accessory_code||"—";}
    }
    return "—";
  }

  let lines:PremiumReceiptLine[]=[];
  if(qitems.length){
    lines=qitems.map((x:any)=>({
      section:x.section_name||"Equipment",
      description:x.description||"Rental item",
      assetRef:refFor(x),
      quantity:n(x.quantity),
      days:n(x.rental_days),
      rate:n(x.unit_rate_inr),
      amount:x.line_total_inr==null?n(x.quantity)*n(x.rental_days)*n(x.unit_rate_inr):n(x.line_total_inr)
    }));
  }else{
    const rentalDays=Math.max(1,Math.ceil((new Date(booking.end_at||Date.now()).getTime()-new Date(booking.start_at||Date.now()).getTime())/86400000)||1);
    for(const x of cameraPool){
      lines.push({section:"Camera",description:x.cameras?.name||"Camera",assetRef:x.cameras?.serial_number||x.cameras?.camera_code||"—",quantity:1,days:rentalDays,rate:n(x.daily_rate_inr),amount:n(x.daily_rate_inr)*rentalDays});
    }
    for(const x of accessoryPool){
      lines.push({section:"Accessories",description:x.accessories?.name||"Accessory",assetRef:x.accessories?.serial_number||x.accessories?.accessory_code||"—",quantity:n(x.quantity)||1,days:rentalDays,rate:n(x.daily_rate_inr),amount:n(x.daily_rate_inr)*(n(x.quantity)||1)*rentalDays});
    }
    for(const x of (subrentals||[])){
      lines.push({section:x.section_name||"External Equipment",description:x.description||"External rental",assetRef:"—",quantity:n(x.quantity)||1,days:n(x.rental_days)||rentalDays,rate:n(x.customer_rate_inr),amount:n(x.customer_rate_inr)*(n(x.quantity)||1)*(n(x.rental_days)||rentalDays)});
    }
    if(!lines.length){
      lines=[{section:"Rental",description:"Cinema equipment rental package",assetRef:"—",quantity:1,days:rentalDays,rate:n(r.rental_amount_inr),amount:n(r.rental_amount_inr)}];
    }
  }

  const posted=(paymentsRaw||[]).filter((p:any)=>p.status==="posted");
  const reversedIds=new Set(posted.filter((p:any)=>p.transaction_type==="reversal"&&p.reversed_payment_id).map((p:any)=>p.reversed_payment_id));
  const effective=posted.filter((p:any)=>["payment","adjustment"].includes(p.transaction_type)&&!reversedIds.has(p.id));
  const payments:PremiumReceiptPayment[]=effective.map((p:any)=>({
    id:p.id,date:p.received_at,method:p.method||"Not specified",reference:p.reference||"—",amount:n(p.amount_inr)
  }));

  const grand=n(r.rental_amount_inr)+n(r.damage_charges_inr)+n(r.late_charges_inr)+n(r.other_charges_inr)-n(r.discount_inr);
  const paid=n(r.amount_paid_inr);
  const balance=Math.max(0,n(r.balance_inr));
  const status=balance<=0?"PAID":paid>0?"PARTIALLY PAID":"BALANCE DUE";

  return {
    id:r.id,
    receiptCode:r.receipt_code,
    issuedAt:r.issued_at,
    status,
    customer:{
      name:r.customers?.name||booking.contact_name||"Customer",
      company:r.customers?.company_name||booking.production_name||"",
      phone:r.customers?.phone||booking.contact_phone||"",
      email:r.customers?.email||""
    },
    rental:{
      bookingCode:booking.booking_code||"",
      quotationCode:quotation?.quotation_code||"",
      project:booking.project_name||"",
      production:booking.production_name||"",
      pickup:dateTime(booking.start_at),
      returnAt:dateTime(booking.end_at),
      duration:duration(booking.start_at,booking.end_at),
      pickupLocation:booking.pickup_location||"",
      returnLocation:booking.return_location||"",
      operator:booking.operator_name||""
    },
    lines,
    charges:{
      itemSubtotal:quotation?n(quotation.subtotal_inr):null,
      quotationDiscount:quotation?n(quotation.discount_inr):0,
      quotationTax:quotation?n(quotation.tax_inr):0,
      quotationOther:quotation?n(quotation.other_charges_inr):0,
      rentalTotal:n(r.rental_amount_inr),
      damage:n(r.damage_charges_inr),
      late:n(r.late_charges_inr),
      additional:n(r.other_charges_inr),
      receiptDiscount:n(r.discount_inr),
      grandTotal:grand
    },
    payments,
    paid,
    balance,
    notes:r.return_notes||""
  };
}
