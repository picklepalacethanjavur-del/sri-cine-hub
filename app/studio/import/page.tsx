import { requireStaff } from "@/lib/auth";
import { ImportWizard } from "./ImportWizard";

export default async function ImportPage() {
  const { supabase } = await requireStaff();

  const [{ data: cameras }, { data: accessories }, { data: rates }] = await Promise.all([
    supabase.from("cameras").select("id,camera_code,name,manufacturer,model").neq("status", "retired").order("camera_code"),
    supabase.from("accessories").select("id,accessory_code,name,category").neq("status", "retired").order("accessory_code"),
    supabase.from("internal_rates").select("camera_id,accessory_id,daily_rate_inr").order("effective_from", { ascending: false }),
  ]);

  const rateMap = new Map<string, number>();
  for (const r of rates || []) {
    if (r.camera_id && !rateMap.has(`cam-${r.camera_id}`)) rateMap.set(`cam-${r.camera_id}`, r.daily_rate_inr);
    if (r.accessory_id && !rateMap.has(`acc-${r.accessory_id}`)) rateMap.set(`acc-${r.accessory_id}`, r.daily_rate_inr);
  }

  const catalog = [
    ...(cameras || []).map((c: any) => ({
      id: c.id,
      type: "camera" as const,
      code: c.camera_code,
      name: [c.name, c.manufacturer, c.model].filter(Boolean).join(" "),
      rate: rateMap.get(`cam-${c.id}`) || 0,
    })),
    ...(accessories || []).map((a: any) => ({
      id: a.id,
      type: "accessory" as const,
      code: a.accessory_code,
      name: [a.name, a.category].filter(Boolean).join(" "),
      rate: rateMap.get(`acc-${a.id}`) || 0,
    })),
  ];

  return (
    <section className="adminShell v6AdminShell">
      <div className="eyebrow">IMPORT</div>
      <h1 style={{ marginBottom: 4 }}>Quote from Message</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
        Paste a WhatsApp message or any equipment list — we&apos;ll match items to your catalog.
      </p>
      <ImportWizard catalog={catalog} />
    </section>
  );
}
