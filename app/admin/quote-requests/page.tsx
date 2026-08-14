import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { requireStaff } from "@/lib/auth";

function label(status:string){
  if(status==="new") return "Received";
  if(status==="reviewing") return "Pricing";
  if(status==="quoted") return "Quotation Generated";
  if(status==="converted") return "Converted";
  if(status==="closed") return "Closed";
  return status;
}

export default async function QuoteRequests(){
  const {supabase}=await requireStaff();
  const {data,error}=await supabase
    .from("quote_requests")
    .select("*")
    .order("created_at",{ascending:false});

  const rows=data||[];
  const active=rows.filter(r=>["new","reviewing"].includes(r.status));
  const generated=rows.filter(r=>["quoted","converted","closed"].includes(r.status));

  return <section className="adminShell">
    <div className="eyebrow">INCOMING CUSTOMER REQUESTS</div>
    <h1>Quote Requests</h1>
    <AdminNav/>
    {error&&<div className="errorBox">{error.message}</div>}

    <div className="metricGrid quoteMetrics">
      <div className="metric"><span>Received</span><b>{rows.filter(r=>r.status==="new").length}</b></div>
      <div className="metric"><span>Pricing</span><b>{rows.filter(r=>r.status==="reviewing").length}</b></div>
      <div className="metric"><span>Generated</span><b>{rows.filter(r=>r.status==="quoted").length}</b></div>
      <div className="metric"><span>Converted</span><b>{rows.filter(r=>r.status==="converted").length}</b></div>
    </div>

    <div className="adminPanel">
      <h2>Received / Pricing</h2>
      {active.length?active.map(r=><Link className="clickableQuoteRow" href={`/admin/quote-requests/${r.id}`} key={r.id}>
        <div>
          <b>{r.request_code} · {r.company_name||r.name}</b>
          <span>{r.project_name||"Project"} · {new Date(r.start_at).toLocaleString("en-IN")} → {new Date(r.end_at).toLocaleString("en-IN")}</span>
          <span>{r.phone}</span>
        </div>
        <em className={`status ${r.status}`}>{label(r.status)}</em>
      </Link>):<p>No requests waiting for pricing.</p>}
    </div>

    <div className="adminPanel">
      <h2>Generated / Completed</h2>
      {generated.length?generated.map(r=><Link className="clickableQuoteRow" href={`/admin/quote-requests/${r.id}`} key={r.id}>
        <div>
          <b>{r.request_code} · {r.company_name||r.name}</b>
          <span>{r.project_name||"Project"}</span>
        </div>
        <em className={`status ${r.status}`}>{label(r.status)}</em>
      </Link>):<p>No generated quotations yet.</p>}
    </div>
  </section>;
}
