import { EquipmentCard } from "@/components/EquipmentCard";
import { equipment } from "@/lib/data";

export default function EquipmentPage(){
  const cats=[...new Set(equipment.map(x=>x.category))];
  return <><section className="pageHero"><div className="eyebrow">RENTAL INVENTORY</div><h1>Production equipment for every stage.</h1><p>Browse categories and request exact availability for your production dates. Pricing is confirmed by the rental team based on package, duration and support requirements.</p></section>
  {cats.map(cat=><section className="section" key={cat}><div className="sectionHeading"><h2>{cat}</h2><span>{equipment.filter(x=>x.category===cat).length} options</span></div><div className="equipmentGrid">{equipment.filter(x=>x.category===cat).map(i=><EquipmentCard item={i} key={i.id}/>)}</div></section>)}</>;
}
