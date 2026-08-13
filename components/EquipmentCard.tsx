import type { EquipmentItem } from "@/lib/types";

export function EquipmentCard({ item }: { item: EquipmentItem }) {
  return <article className="equipmentCard">
    <div className="equipmentMedia"><span>{item.category}</span></div>
    <div className="equipmentBody"><div className="eyebrow">{item.category}</div><h3>{item.name}</h3><p>{item.description}</p><a className="textLink" href={`/request-quote?equipment=${encodeURIComponent(item.name)}`}>Request availability →</a></div>
  </article>;
}
