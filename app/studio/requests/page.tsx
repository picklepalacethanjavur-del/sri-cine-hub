import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { NewStudioRequest } from "./NewStudioRequest";

function statusLabel(s: string) {
  const m: Record<string, string> = { new: "New", reviewing: "Pricing", quoted: "Quoted", converted: "Converted", closed: "Closed" };
  return m[s] || s;
}

export default async function StudioRequests() {
  const { supabase, user } = await requireStaff();
  const { data } = await supabase
    .from("quote_requests")
    .select("id,request_code,status,company_name,name,project_name,start_at,end_at,phone,created_at")
    .order("created_at", { ascending: false });
  const rows = data || [];
  const active = rows.filter((r: any) => ["new","reviewing"].includes(r.status));
  const done   = rows.filter((r: any) => ["quoted","converted","closed"].includes(r.status));

  return (
    <div className="studioPage">
      <div className="studioPageHeader studioPageHeaderRow">
        <div>
          <p className="studioEyebrow">SALES</p>
          <h1 className="studioH1">Quote Requests</h1>
        </div>
        <NewStudioRequest userId={user.id} />
      </div>

      <div className="studioMetrics">
        <div className="studioMetric"><span>New</span><b>{rows.filter((r: any) => r.status === "new").length}</b></div>
        <div className="studioMetric"><span>Pricing</span><b>{rows.filter((r: any) => r.status === "reviewing").length}</b></div>
        <div className="studioMetric"><span>Quoted</span><b>{rows.filter((r: any) => r.status === "quoted").length}</b></div>
        <div className="studioMetric"><span>Converted</span><b>{rows.filter((r: any) => r.status === "converted").length}</b></div>
      </div>

      <section className="studioCard">
        <h2 className="studioCardTitle">Active requests</h2>
        {active.length === 0 && <p className="studioEmpty">No active requests.</p>}
        {active.map((r: any) => (
          <Link href={`/studio/requests/${r.id}`} key={r.id} className="studioRow">
            <div className="studioRowInfo">
              <b>{r.request_code} · {r.company_name || r.name || "Untitled"}</b>
              <span>{r.project_name || "No project"} · {r.start_at ? new Date(r.start_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Dates TBC"}</span>
            </div>
            <span className={`studioBadge ${r.status}`}>{statusLabel(r.status)}</span>
          </Link>
        ))}
      </section>

      {done.length > 0 && (
        <section className="studioCard">
          <h2 className="studioCardTitle">Generated / closed</h2>
          {done.map((r: any) => (
            <Link href={`/studio/requests/${r.id}`} key={r.id} className="studioRow">
              <div className="studioRowInfo">
                <b>{r.request_code} · {r.company_name || r.name || "Untitled"}</b>
                <span>{r.project_name || "No project"}</span>
              </div>
              <span className={`studioBadge ${r.status}`}>{statusLabel(r.status)}</span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
