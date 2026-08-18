"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/equipment", label: "Equipment" },
  { href: "/request-quote", label: "Request Quote" },
  { href: "/#contact", label: "Contact" },
];

export function SiteHeader() {
  const path = usePathname();
  if (path.startsWith("/studio") || path.startsWith("/admin") || path.startsWith("/invest") || path === "/login") return null;
  return (
    <header className="siteHeader">
      <div className="headerInner">
        <Link className="brand" href="/">
          <img src="/sri-cine-hub-logo.jpg" alt="Sri Cine Hub" />
          <span>SRI CINE HUB</span>
        </Link>
        <nav className="siteNav">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} className={path === href ? "active" : ""}>{label}</Link>
          ))}
          <Link href="/studio" className="staffLink">Staff</Link>
        </nav>
        <Link href="/request-quote" className="headerCta">Request Quote</Link>
      </div>
    </header>
  );
}
