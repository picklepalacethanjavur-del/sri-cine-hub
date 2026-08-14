import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { PrintButton } from "./PrintButton";

const money=(n:any)=>`₹${Number(n||0).toLocaleString("en-IN")}`;

export default async function PrintableQuotation({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const {supabase}=await requireStaff();
  const [{data:q},{data:items},{data:req}] = await Promise.all([
    supabase.from("quotations").select("*,customers(*)").eq("id",id).single(),
    supabase.from("quotation_items").select("*").eq("quotation_id",id).order("sort_order"),
    supabase.from("quotations").select("quote_request_id,quote_requests(*)").eq("id",id).single()
  ]);
  if(!q) notFound();
  const request=(req as any)?.quote_requests;

  return <main className="printDocument">
    <div className="printToolbar printHide"><a href={`/admin/quotations/${id}`}>← Back to quotation</a><PrintButton/></div>
    <section className="quotationPaper">
      <header className="quotationHeader">
        <div><h1>SRI CINE HUB PVT. LTD.</h1><p>Camera Rental · Lenses · Lights · Grip · Post Production</p></div>
        <div className="quoteNumber"><span>QUOTATION</span><b>{q.quotation_code}</b><small>Date: {new Date(q.created_at).toLocaleDateString("en-IN")}</small><small>Valid until: {q.valid_until||"—"}</small></div>
      </header>

      <div className="quotationParties">
        <div><span>Customer</span><b>{q.customers?.company_name||q.customers?.name||"Customer"}</b><p>{q.customers?.name}</p><p>{q.customers?.phone}</p><p>{q.customers?.email}</p></div>
        <div><span>Project / Rental</span><b>{request?.project_name||"Project"}</b><p>{request?`${new Date(request.start_at).toLocaleString("en-IN")} → ${new Date(request.end_at).toLocaleString("en-IN")}`:""}</p></div>
      </div>

      <table className="printQuoteTable">
        <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Days</th><th>Rate</th><th>Amount</th></tr></thead>
        <tbody>{(items||[]).map((x:any,i:number)=><tr key={x.id}><td>{i+1}</td><td><b>{x.description}</b>{x.notes&&<small>{x.notes}</small>}</td><td>{Number(x.quantity)}</td><td>{Number(x.rental_days)}</td><td>{money(x.unit_rate_inr)}</td><td>{money(x.line_total_inr)}</td></tr>)}</tbody>
      </table>

      <div className="printTotals">
        <div><span>Subtotal</span><b>{money(q.subtotal_inr)}</b></div>
        {Number(q.discount_inr)>0&&<div><span>Discount</span><b>- {money(q.discount_inr)}</b></div>}
        {Number(q.tax_inr)>0&&<div><span>Tax</span><b>{money(q.tax_inr)}</b></div>}
        {Number(q.other_charges_inr)>0&&<div><span>Other charges</span><b>{money(q.other_charges_inr)}</b></div>}
        <div className="printGrandTotal"><span>Grand Total</span><b>{money(q.total_inr)}</b></div>
      </div>

      {q.customer_notes&&<div className="quoteTerms"><h3>Notes / Terms</h3><p>{q.customer_notes}</p></div>}
      <footer className="quotationFooter"><b>SRI CINE HUB PVT. LTD.</b><span>Chennai · Camera Rental & Production Services</span></footer>
    </section>
  </main>;
}
