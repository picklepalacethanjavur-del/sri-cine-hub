import Link from "next/link";
import { address, phones } from "@/lib/data";

export function SiteFooter() {
  return (
    <footer className="siteFooter">
      <div className="footerInner">
        <div className="footerBrand">
          <p className="footerLogo">SRI CINE HUB</p>
          <p className="footerTagline">Cinema cameras · Lights · Grip · Post Production</p>
          <p className="footerAddress">{address}</p>
        </div>
        <div className="footerLinks">
          <p className="footerColLabel">Navigate</p>
          <Link href="/equipment">Equipment</Link>
          <Link href="/request-quote">Request Quote</Link>
          <Link href="/#contact">Contact</Link>
          <Link href="/admin">Staff Portal</Link>
        </div>
        <div className="footerContact">
          <p className="footerColLabel">Call us</p>
          {phones.map(p => (
            <a key={p} href={`tel:${p.replace(/\s/g, "")}`} className="footerPhone">{p}</a>
          ))}
        </div>
      </div>
      <div className="footerBase">
        <span>© {new Date().getFullYear()} Sri Cine Hub Pvt. Ltd. · Chennai</span>
      </div>
    </footer>
  );
}
