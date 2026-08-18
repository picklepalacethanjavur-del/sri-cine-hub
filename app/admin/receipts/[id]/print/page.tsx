
import {notFound} from "next/navigation";
import {requireStaff} from "@/lib/auth";
import {DocumentActions} from "@/components/DocumentActions";
import {ReceiptCorrectionPanel} from "@/components/ReceiptCorrectionPanel";
import {loadPremiumReceiptData} from "@/lib/receiptData";

const money=(n:any)=>`₹${Number(n||0).toLocaleString("en-IN")}`;
const date=(v:string)=>new Date(v).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});

export default async function ReceiptDocument({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const {supabase}=await requireStaff();
  const loaded=await loadPremiumReceiptData(supabase,id);
  if(!loaded){notFound();return null as never;}
  const data=loaded;

  const {data:receipt}=await supabase.from("receipts").select("*").eq("id",id).single();
  let payments:any[]=[];
  let correctionAudit:any[]=[];
  if(receipt?.booking_id){
    const [{data:p},{data:a}]=await Promise.all([
      supabase.from("payments").select("*").eq("booking_id",receipt.booking_id).order("received_at",{ascending:false}),
      supabase.from("audit_log").select("id,action,created_at,old_data,new_data").or(`entity_id.eq.${receipt.booking_id},entity_id.eq.${id}`).order("created_at",{ascending:false})
    ]);
    payments=p||[];correctionAudit=a||[];
  }

  const customerTitle=data.customer.company||data.customer.name;
  return <main className="printDocument premiumReceiptScreen">
    <DocumentActions
      closeHref="/admin/receipts"
      downloadHref={`/api/documents/receipt/${id}/pdf`}
      fileName={`SriCineHub-${data.receiptCode}.pdf`}
      whatsappText={`Hi ${customerTitle}, thank you. Please find Sri Cine Hub receipt ${data.receiptCode}.`}
    />
    {receipt&&<ReceiptCorrectionPanel receipt={receipt} payments={payments} audit={correctionAudit}/>}

    <section className="premiumReceiptPaper">
      <header className="premiumReceiptHeader">
        <div>
          <h1>SRI CINE HUB PVT. LTD.</h1>
          <p>Cinema Equipment Rental &amp; Production Services</p>
          <small>Chennai, Tamil Nadu</small>
        </div>
        <div className="premiumReceiptIdentity">
          <span>RENTAL RECEIPT</span>
          <b>{data.receiptCode}</b>
          <small>{date(data.issuedAt)}</small>
          <em className={`receiptStatus ${data.status.toLowerCase().replaceAll(" ","-")}`}>{data.status}</em>
        </div>
      </header>

      <div className="premiumInfoGrid">
        <section className="premiumInfoCard">
          <h3>Client Information</h3>
          <dl>
            <div><dt>Client</dt><dd>{data.customer.company||data.customer.name}</dd></div>
            {data.customer.company&&data.customer.name!==data.customer.company&&<div><dt>Contact</dt><dd>{data.customer.name}</dd></div>}
            {data.customer.phone&&<div><dt>Phone</dt><dd>{data.customer.phone}</dd></div>}
            {data.customer.email&&<div><dt>Email</dt><dd>{data.customer.email}</dd></div>}
          </dl>
        </section>
        <section className="premiumInfoCard">
          <h3>Rental Summary</h3>
          <dl>
            <div><dt>Booking</dt><dd>{data.rental.bookingCode||"—"}</dd></div>
            {data.rental.quotationCode&&<div><dt>Quotation</dt><dd>{data.rental.quotationCode}</dd></div>}
            <div><dt>Project</dt><dd>{data.rental.project||data.rental.production||"—"}</dd></div>
            {data.rental.production&&data.rental.production!==data.rental.project&&<div><dt>Production</dt><dd>{data.rental.production}</dd></div>}
            <div><dt>Pickup</dt><dd>{data.rental.pickup}</dd></div>
            <div><dt>Return</dt><dd>{data.rental.returnAt}</dd></div>
            <div><dt>Duration</dt><dd>{data.rental.duration}</dd></div>
            {data.rental.pickupLocation&&<div><dt>Pickup Location</dt><dd>{data.rental.pickupLocation}</dd></div>}
            {data.rental.returnLocation&&<div><dt>Return Location</dt><dd>{data.rental.returnLocation}</dd></div>}
            {data.rental.operator&&<div><dt>Operator</dt><dd>{data.rental.operator}</dd></div>}
          </dl>
        </section>
      </div>

      <section className="premiumReceiptSection">
        <h2>Equipment &amp; Services</h2>
        <div className="premiumReceiptTableWrap">
          <table className="premiumReceiptTable">
            <colgroup>
              <col className="receiptColNo"/>
              <col className="receiptColDescription"/>
              <col className="receiptColAsset"/>
              <col className="receiptColQty"/>
              <col className="receiptColDays"/>
              <col className="receiptColRate"/>
              <col className="receiptColAmount"/>
            </colgroup>
            <thead><tr><th>#</th><th>Description</th><th>Asset / Serial</th><th>Qty</th><th>Days</th><th>Rate</th><th>Amount</th></tr></thead>
            <tbody>{data.lines.map((line,i)=><tr key={`${line.section}-${i}`}>
              <td>{i+1}</td><td><b>{line.description}</b><small>{line.section}</small></td><td>{line.assetRef}</td><td>{line.quantity}</td><td>{line.days}</td><td>{money(line.rate)}</td><td><b>{money(line.amount)}</b></td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <div className="premiumFinancialGrid">
        <section className="premiumChargeCard">
          <h3>Charges</h3>
          <dl>
            {data.charges.itemSubtotal!==null&&<div><dt>Equipment / services subtotal</dt><dd>{money(data.charges.itemSubtotal)}</dd></div>}
            {data.charges.quotationDiscount>0&&<div><dt>Quotation discount</dt><dd>- {money(data.charges.quotationDiscount)}</dd></div>}
            {data.charges.quotationTax>0&&<div><dt>Tax</dt><dd>{money(data.charges.quotationTax)}</dd></div>}
            {data.charges.quotationOther>0&&<div><dt>Quotation other charges</dt><dd>{money(data.charges.quotationOther)}</dd></div>}
            <div><dt>Rental total</dt><dd>{money(data.charges.rentalTotal)}</dd></div>
            {data.charges.damage>0&&<div><dt>Damage charges</dt><dd>{money(data.charges.damage)}</dd></div>}
            {data.charges.late>0&&<div><dt>Late charges</dt><dd>{money(data.charges.late)}</dd></div>}
            {data.charges.additional>0&&<div><dt>Additional charges</dt><dd>{money(data.charges.additional)}</dd></div>}
            {data.charges.receiptDiscount>0&&<div><dt>Receipt discount</dt><dd>- {money(data.charges.receiptDiscount)}</dd></div>}
            <div className="premiumGrand"><dt>Grand Total</dt><dd>{money(data.charges.grandTotal)}</dd></div>
          </dl>
        </section>

        <section className="premiumPaymentCard">
          <div className="premiumPaymentHead"><h3>Payment Summary</h3><em className={`receiptStatus ${data.status.toLowerCase().replaceAll(" ","-")}`}>{data.status}</em></div>
          <dl>
            <div><dt>Total Paid</dt><dd>{money(data.paid)}</dd></div>
            <div className="premiumBalance"><dt>Balance</dt><dd>{money(data.balance)}</dd></div>
          </dl>
          <small>{data.payments.length} posted payment transaction{data.payments.length===1?"":"s"}</small>
        </section>
      </div>

      <section className="premiumReceiptSection">
        <h2>Payment History</h2>
        {data.payments.length?<table className="premiumPaymentTable"><thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Amount</th></tr></thead><tbody>{data.payments.map(p=><tr key={p.id}><td>{date(p.date)}</td><td>{p.method}</td><td>{p.reference}</td><td>{money(p.amount)}</td></tr>)}</tbody></table>:<div className="premiumEmptyState">No payment recorded yet.</div>}
      </section>

      {data.notes&&<section className="premiumReceiptSection premiumNotes"><h2>Notes</h2><p>{data.notes}</p></section>}

      <footer className="premiumReceiptFooter">
        <div><b>SRI CINE HUB PVT. LTD.</b><span>Thank you for choosing Sri Cine Hub.</span></div>
        <small>This receipt reflects the current rental charges and posted payment ledger.</small>
      </footer>
    </section>
  </main>;
}
