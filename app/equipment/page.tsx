import Link from "next/link";
import { equipment } from "@/lib/data";

const categories = [...new Set(equipment.map(x => x.category))];

export default function EquipmentPage() {
  return (
    <>
      <section className="pageHeroSlim">
        <p className="eyebrow">RENTAL INVENTORY</p>
        <h1 className="siteH1">Production equipment<br />for every stage.</h1>
        <p className="pageHeroSub">
          Pricing is confirmed by the team based on package, duration and support.
          Browse below and <Link href="/request-quote" className="inlineLink">request a quote</Link> for exact availability.
        </p>
      </section>

      {categories.map(cat => (
        <section
          className="equipSection"
          key={cat}
          id={cat.toLowerCase().replace(/\s+/g, "-")}
        >
          <div className="equipSectionHead">
            <h2 className="equipCatTitle">{cat}</h2>
            <span className="equipCatCount">{equipment.filter(x => x.category === cat).length} options</span>
          </div>
          <div className="equipGrid">
            {equipment.filter(x => x.category === cat).map(item => (
              <div className="equipCard" key={item.id}>
                <div className="equipCardMedia" />
                <div className="equipCardBody">
                  <h3 className="equipCardName">{item.name}</h3>
                  <p className="equipCardDesc">{item.description}</p>
                  <Link href="/request-quote" className="equipCardCta">Request availability →</Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="equipCta">
        <p className="eyebrow">NEXT STEP</p>
        <h2 className="siteH2">Ready to build your package?</h2>
        <p className="equipCtaSub">Tell us your dates and equipment needs — we'll confirm availability and pricing within the day.</p>
        <Link href="/request-quote" className="btn btnGold">Request a Quote</Link>
      </section>
    </>
  );
}
