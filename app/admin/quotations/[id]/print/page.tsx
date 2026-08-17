import {notFound} from "next/navigation";
import {requireStaff} from "@/lib/auth";
import {QuotationDocumentActions} from "./QuotationDocumentActions";

const money=(n:any)=>`₹${Number(n||0).toLocaleString("en-IN")}`;

export default async function PrintableQuotation({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{generated?:string}>}){
  const {id}=await params;const query=await searchParams;const {supabase}=await requireStaff();
  const [{data:q},{data:items},{data:req}]=await Promise.all([
    supabase.from("quotations").select("*,customers(*)").eq("id",id).single(),
    supabase.from("quotation_items").select("*").eq("quotation_id",id).order("sort_order"),
    supabase.from("quotations").select("quote_request_id,quote_requests(*)").eq("id",id).single()
  ]);
  if(!q)notFound();
  const request=(req as any)?.quote_requests;
  const groups=new Map<string,any[]>();
  for(const item of items||[]){const section=item.section_name||"General";if(!groups.has(section))groups.set(section,[]);groups.get(section)!.push(item);}

  return <main className="printDocument">
    {query.generated==="1"&&<div className="documentSuccessBanner printHide">✓ Quotation {q.quotation_code} generated successfully. Review the document, then mark it as sent when you share it with the customer.</div>}
    <QuotationDocumentActions quotationId={id} status={q.status}/>
    <section className="quotationPaper">
      <header className="quotationHeader"><div><h1>SRI CINE HUB PVT. LTD.</h1><p>Camera Rental · Lenses · Lights · Grip · Transport · Production Services</p></div><div className="quoteNumber"><span>QUOTATION</span><b>{q.quotation_code}</b><small>Date: {new Date(q.created_at).toLocaleDateString("en-IN")}</small><small>Valid until: {q.valid_until||"—"}</small></div></header>
      <div className="quotationParties"><div><span>Customer</span><b>{q.customers?.company_name||q.customers?.name||"Customer"}</b><p>{q.customers?.name}</p><p>{q.customers?.phone}</p><p>{q.customers?.email}</p></div><div><span>Project / Rental</span><b>{request?.project_name||"Project"}</b><p>{request?`${new Date(request.start_at).toLocaleString("en-IN")} → ${new Date(request.end_at).toLocaleString("en-IN")}`:""}</p></div></div>

      <table className="printQuoteTable groupedQuoteTable">
        <thead><tr><th>S. No</th><th>Description</th><th>Qty</th><th>Days</th><th>Rate</th><th>Amount</th></tr></thead>
        <tbody>{Array.from(groups.entries()).map(([section,sectionItems])=><FragmentSection key={section} section={section} items={sectionItems}/>)}</tbody>
      </table>

      <div className="printTotals"><div><span>Subtotal</span><b>{money(q.subtotal_inr)}</b></div>{Number(q.discount_inr)>0&&<div><span>Discount</span><b>- {money(q.discount_inr)}</b></div>}{Number(q.tax_inr)>0&&<div><span>Tax</span><b>{money(q.tax_inr)}</b></div>}{Number(q.other_charges_inr)>0&&<div><span>Other charges</span><b>{money(q.other_charges_inr)}</b></div>}<div className="printGrandTotal"><span>Grand Total</span><b>{money(q.total_inr)}</b></div></div>
      {q.customer_notes&&<div className="quoteTerms"><h3>Notes / Terms</h3><p>{q.customer_notes}</p></div>}
      <footer className="quotationFooter"><b>SRI CINE HUB PVT. LTD.</b><span>Chennai · Camera Rental & Production Services</span></footer>
    </section>
  </main>;
}

function FragmentSection({section,items}:{section:string;items:any[]}){
  return <><tr className="quoteSectionRow"><td colSpan={6}>{section}</td></tr>{items.map((x:any,i:number)=><tr key={x.id}><td>{i+1}</td><td><b>{x.description}</b>{x.notes&&<small>{x.notes}</small>}</td><td>{Number(x.quantity)}</td><td>{Number(x.rental_days)}</td><td>{money(x.unit_rate_inr)}</td><td>{money(x.line_total_inr)}</td></tr>)}</>;
}
