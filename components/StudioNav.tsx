"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";

const MAIN = [
  { href: "/studio",          label: "Today",    exact: true },
  { href: "/studio/requests", label: "Requests"              },
  { href: "/studio/bookings", label: "Bookings"              },
  { href: "/studio/ops",      label: "Ops"                   },
  { href: "/studio/receipts", label: "Receipts"              },
];

const TOOLS = [
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/suppliers", label: "Suppliers" },
  { href: "/admin",           label: "Admin panel" },
];

export function StudioNav({ name }: { name: string }) {
  const path = usePathname();
  function active(href: string, exact = false) {
    return exact ? path === href : path.startsWith(href);
  }
  return (
    <>
      <aside className="studioSidebar">
        <div className="studioSidebarBrand">
          <Link href="/" className="studioBrandLink">SRI CINE HUB</Link>
          <span>Studio</span>
        </div>
        <nav className="studioSidebarNav">
          {MAIN.map(({ href, label, exact }) => (
            <Link key={href} href={href} className={`studioNavItem${active(href, exact) ? " active" : ""}`}>{label}</Link>
          ))}
        </nav>
        <div className="studioSidebarDivider" />
        <nav className="studioSidebarTools">
          {TOOLS.map(({ href, label }) => (
            <Link key={href} href={href} className="studioNavItem dim">{label}</Link>
          ))}
        </nav>
        <div className="studioSidebarFooter">
          <span className="studioUserName">{name}</span>
          <SignOutButton />
        </div>
      </aside>
      <nav className="studioBottomBar">
        {MAIN.map(({ href, label, exact }) => (
          <Link key={href} href={href} className={`studioBottomItem${active(href, exact) ? " active" : ""}`}>
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
