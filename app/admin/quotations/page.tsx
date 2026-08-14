import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { requireStaff } from "@/lib/auth";

export default async function Quotations(){
  const {supabase}=await requireStaff();
  const {data,error}=await supabase
    .from("quotations")
    .select("id,quotation_code,status,valid_until,total_inr,created_at,customers(name,company_name),quote_requests(project_name)")
    .order("created_at",{ascending:false});

  const rows=data||[];
  return <section className="adminShell">
    <div className="eyebrow">GENERATED CUSTOMER DOCUMENTS</div>
    <h1>Quotations</h1>
    <AdminNav/>
    {error&&<div className="errorBox">{error.message}</div>}

    <div className="metricGrid quoteMetrics">
      <div className="metric"><span>Draft</span><b>{rows.filter(q=>q.status==="draft").length}</b></div>
      <div className="metric"><span>Sent</span><b>{rows.filter(q=>q.status==="sent").length}</b></div>
      <div className="metric"><span>Accepted</span><b>{rows.filter(q=>q.status==="accepted").length}</b></div>
      <div className="metric"><span>Converted</span><b>{rows.filter(q=>q.status==="converted").length}</b></div>
    </div>

    <div className="adminPanel">
      <h2>Quotation history</h2>
      {rows.length?rows.map((q:any)=><Link className="clickableQuoteRow" href={`/admin/quotations/${q.id}`} key={q.id}>
        <div>
          <b className="quotationLink">{q.quotation_code}</b>
          <span>{q.customers?.company_name||q.customers?.name||"Customer"} · {q.quote_requests?.project_name||"Project"}</span>
          <span>{q.status} · valid to {q.valid_until||"—"}</span>
        </div>
        <strong>₹{Number(q.total_inr||0).toLocaleString("en-IN")}</strong>
      </Link>):<p>No quotations yet.</p>}
    </div>
  </section>;
}
