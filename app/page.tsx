import Link from "next/link";
import { address, equipment, phones } from "@/lib/data";

const categories = [...new Set(equipment.map(x => x.category))];

const categoryIcons: Record<string, string> = {
  Cameras: "◉",
  Lenses: "◎",
  Lights: "✦",
  Grip: "⊞",
  Transport: "⬡",
  Genset: "⚡",
  "Post Production": "▣",
  Accessories: "◈",
};

const steps = [
  { n: "01", title: "Submit a request", body: "Tell us your shoot dates and the equipment you need. Takes under 2 minutes." },
  { n: "02", title: "Quote confirmation", body: "Our team checks availability, builds your package, and sends a confirmed quote." },
  { n: "03", title: "Checkout with QR scan", body: "Every item is QR-scanned and photographed on departure. Full condition record." },
  { n: "04", title: "Return & receipt", body: "Return scan, condition check, and your rental receipt is generated on the spot." },
];

export default function Home() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="filmHero">
        <div className="filmHero__inner">
          <div className="filmHero__content">
            <p className="eyebrow">SRI CINE HUB · CHENNAI</p>
            <h1 className="filmHero__h1">
              Cameras.<br />
              Lights.<br />
              <span className="goldText">Action.</span>
            </h1>
            <p className="filmHero__sub">
              Cinema-grade equipment for features, commercials and series.
              One studio, every stage of production.
            </p>
            <div className="filmHero__actions">
              <Link href="/equipment" className="btn btnGold">Browse Equipment</Link>
              <Link href="/request-quote" className="btn btnGhost">Request a Quote</Link>
            </div>
          </div>
          <div className="filmHero__mark">
            <img src="/sri-cine-hub-logo.jpg" alt="Sri Cine Hub" />
          </div>
        </div>
      </section>

      {/* ── Services strip ── */}
      <div className="servicesStrip">
        {["Cinema Cameras", "Lenses", "Lighting", "Grip & Rigging", "Transport", "Gensets", "Post Production", "Editing Studio"].map(s => (
          <span key={s}>{s}</span>
        ))}
      </div>

      {/* ── Equipment categories ── */}
      <section className="siteSection" id="equipment">
        <div className="siteSectionHead">
          <div>
            <p className="eyebrow">PRODUCTION INVENTORY</p>
            <h2 className="siteH2">Build the package your shoot needs.</h2>
          </div>
          <Link href="/equipment" className="linkArrow">Full inventory →</Link>
        </div>
        <div className="catGrid">
          {categories.map(cat => {
            const count = equipment.filter(x => x.category === cat).length;
            return (
              <Link href={`/equipment#${cat.toLowerCase().replace(/\s+/g, "-")}`} className="catCard" key={cat}>
                <span className="catIcon">{categoryIcons[cat] || "◆"}</span>
                <strong className="catCount">{count}</strong>
                <p className="catName">{cat}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Featured cameras ── */}
      <section className="siteSection">
        <div className="siteSectionHead">
          <div>
            <p className="eyebrow">FEATURED</p>
            <h2 className="siteH2">Core production services.</h2>
          </div>
        </div>
        <div className="featuredGrid">
          {equipment.filter(x => x.featured).map(item => (
            <Link href="/request-quote" className="featuredCard" key={item.id}>
              <div className="featuredMedia">
                <span className="featuredCat">{item.category}</span>
              </div>
              <div className="featuredBody">
                <h3 className="featuredName">{item.name}</h3>
                <p className="featuredDesc">{item.description}</p>
                <span className="featuredCta">Request this package →</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="siteSection howSection">
        <div className="siteSectionHead">
          <div>
            <p className="eyebrow">WORKFLOW</p>
            <h2 className="siteH2">From request to checkout — same day.</h2>
          </div>
        </div>
        <div className="stepsGrid">
          {steps.map(s => (
            <div className="stepCard" key={s.n}>
              <span className="stepNum">{s.n}</span>
              <h3 className="stepTitle">{s.title}</h3>
              <p className="stepBody">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Contact ── */}
      <section className="contactSection" id="contact">
        <div className="contactInner">
          <div className="contactLeft">
            <p className="eyebrow">GET IN TOUCH</p>
            <h2 className="siteH2">Talk to the rental team.</h2>
            <p className="contactAddress">{address}</p>
            <Link href="/request-quote" className="btn btnGold" style={{ marginTop: "24px", display: "inline-flex" }}>
              Request a Quote
            </Link>
          </div>
          <div className="contactPhones">
            {phones.map(p => (
              <a key={p} href={`tel:${p.replace(/\s/g, "")}`} className="phoneCard">
                <span className="phoneIcon">✆</span>
                <span>{p}</span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
